const db = require('../config/database');

// 推荐奖励必填配置项（key → 说明）
const REQUIRED_REFERRAL_KEYS = [
  'referral_reward_dr_dr', 'referral_reward_dr_mxj', 'referral_reward_dr_cjhh',
  'referral_reward_mxj_dr', 'referral_reward_mxj_mxj', 'referral_reward_mxj_cjhh',
  'referral_reward_cjhh_dr', 'referral_reward_cjhh_mxj', 'referral_reward_cjhh_cjhh',
];

// 启动时校验推荐奖励配置：缺失或为零时打印警告（不阻断启动）
db.query('SELECT `key`, value FROM configs WHERE `key` IN (?,?,?,?,?,?,?,?,?)', REQUIRED_REFERRAL_KEYS)
  .then(rows => {
    const present = new Set(rows.map(r => r.key));
    REQUIRED_REFERRAL_KEYS.forEach(key => {
      if (!present.has(key)) {
        console.warn(`[Commission] 推荐奖励配置缺失: ${key}，将按 0 处理`);
      }
    });
  })
  .catch((e) => {
    console.warn(`[Commission] 推荐奖励配置加载失败（数据库可能未就绪）: ${e.message}，将按 0 处理`);
  });

const Commission = {
  /**
   * 订单确认后自动结算佣金 — 差价模式
   *
   * 业务逻辑：
   * - 爆款课程：L1 直推人获得 hot_commission_rate% 的佣金（不走差价逻辑）
   * - 普通课程：L1 直推人获得差价佣金 = 课程售价 - 该等级拿货价
   *   （赠送名额内：拿货价=0，差价=课程全价；差价购买后：拿货价=拿货价，差价=差价）
   * - L2/L3 不获得销售佣金
   * - 推荐奖励在 approve 时已结算，不在此处处理
   *
   * @param {number} orderId - 订单 ID
   * @param {object} [existingConn] - 可选，若传入则复用该连接的事务（确保原子性）
   */
  async settleForOrder(orderId, existingConn = null) {
    const shouldRelease = existingConn === null;
    const shouldCommit = existingConn === null; // 仅有外部传入连接时由调用方控制提交
    const conn = existingConn || await db.getConnection();
    if (!existingConn) await conn.beginTransaction();
    try {
      // 1. 幂等检查：若已结算则直接返回空（防止重复调用）
      //    也检查订单状态：只有 status=1（已确认/已支付）才结算
      const [order] = await conn.query(
        'SELECT * FROM orders WHERE id = ? AND commission_settled = 0 AND status = 1 FOR UPDATE',
        [orderId]
      );
      if (!order?.length) {
        if (!existingConn) { await conn.rollback(); conn.release(); }
        return [];
      }
      const o = order[0];

      // 2. 读取课程价格
      // 2. 读取课程价格 + 爆款课标识
      const [course] = await conn.query(
        'SELECT price, is_hot, hot_commission_rate FROM courses WHERE id = ?',
        [o.course_id]
      );
      if (!course.length) {
        if (!existingConn) { await conn.rollback(); conn.release(); }
        return [];
      }
      const price = parseFloat(course[0].price);
      if (price <= 0) {
        if (!existingConn) { await conn.rollback(); conn.release(); }
        return [];
      }

      // 3. 向上追溯 L1/L2/L3 有效分销商（含各自等级）
      let agentsChain;
      try {
        agentsChain = await resolveAgentChain(conn, o.direct_agent_id, o.user_id);
      } catch(e) {
        console.error('[Commission settleForOrder] resolveAgentChain ERROR:', e.message);
        throw e;
      }

      // 5. 爆款课程：独立佣金体系，单层直推
      if (course[0].is_hot === 1) {
        const hotRate = parseFloat(course[0].hot_commission_rate) || 0;
        let amount = 0;
        if (hotRate > 0 && agentsChain.L1) {
          amount = Math.round(price * hotRate / 100 * 100) / 100;
          if (amount > 0) {
            await conn.execute(
              `INSERT INTO commissions (user_id, order_id, level, type, amount, profit_margin, status, created_at)
               VALUES (?, ?, 1, 'HOT_SALES', ?, ?, 1, NOW())`,
              [agentsChain.L1.user_id, orderId, amount, amount]
            );
          }
        }
        await conn.execute(
          'UPDATE orders SET commission_settled = 1, confirm_time = NOW() WHERE id = ?',
          [orderId]
        );
        if (shouldCommit) await conn.commit();
        if (shouldRelease) conn.release();
        return [{ userId: agentsChain.L1?.user_id, level: 1, amount: amount || 0 }];
      }

      // 6. 普通课程差价佣金：只有 L1 直推人获得
      //    差价 = 课程售价 - L1 等级的拿货价（从 agent_levels.purchase_price 读取）
      //    source_type='gift'：拿货价=0，差价=课程全价（平台赠送名额）
      //    source_type='purchase'：拿货价=agent_levels.purchase_price，差价=课程售价-拿货价
      if (agentsChain.L1) {
        // 读取 L1 的拿货价
        const [levelCfg] = await conn.query(
          'SELECT purchase_price FROM agent_levels WHERE level = ? LIMIT 1',
          [agentsChain.L1.level]
        );
        const purchasePrice = levelCfg.length ? parseFloat(levelCfg[0].purchase_price || 0) : 0;

        // 读取订单来源（赠送名额 or 差价购买）
        const [orderInfo] = await conn.query(
          'SELECT agent_account_id FROM orders WHERE id = ? LIMIT 1',
          [orderId]
        );
        let sourceType = 'gift';
        if (orderInfo.length && orderInfo[0].agent_account_id) {
          const [accountInfo] = await conn.query(
            'SELECT source_type FROM agent_accounts WHERE id = ? LIMIT 1',
            [orderInfo[0].agent_account_id]
          );
          if (accountInfo.length) sourceType = accountInfo[0].source_type;
        }

        // 计算差价
        const costPrice = sourceType === 'gift' ? 0 : purchasePrice;
        const profitMargin = Math.max(0, price - costPrice);
        const amount = Math.round(profitMargin * 100) / 100;

        if (amount > 0) {
          await conn.execute(
            `INSERT INTO commissions (user_id, order_id, level, type, amount, profit_margin, status, created_at)
             VALUES (?, ?, 1, 'SALES', ?, ?, 1, NOW())`,
            [agentsChain.L1.user_id, orderId, amount, profitMargin]
          );
        }
        await conn.execute(
          'UPDATE orders SET commission_settled = 1, confirm_time = NOW() WHERE id = ?',
          [orderId]
        );
        if (shouldCommit) await conn.commit();
        if (shouldRelease) conn.release();
        return [{ userId: agentsChain.L1.user_id, level: 1, amount }];
      }

      // 无 L1 分销商（平台引流订单）：直接标记已结算，不发佣金
      await conn.execute(
        'UPDATE orders SET commission_settled = 1, confirm_time = NOW() WHERE id = ?',
        [orderId]
      );
      if (shouldCommit) await conn.commit();
      if (shouldRelease) conn.release();
      return [];
    } catch (e) {
      await conn.rollback();  // 空事务回滚无害，始终回滚确保连接不泄漏
      if (shouldRelease) conn.release();
      throw e;
    }
  },

  /**
   * 订单退款/取消时撤销佣金（status=1→3）
   * @param {number} orderId - 订单 ID
   * @param {object} [existingConn] - 可选外部连接（复用事务）
   * @returns {Promise<{revoked: number, withdrawn: number}>} revoked=已撤销笔数，withdrawn=已提现笔数（含已提现的佣金不可退款）
   */
  async revokeForOrder(orderId, existingConn = null) {
    const shouldRelease = existingConn === null;
    const shouldCommit = existingConn === null;
    const conn = existingConn || await db.getConnection();
    if (!existingConn) await conn.beginTransaction();
    try {
      // 查出所有佣金记录（status=1 可撤销，status=2 已提现不可撤销）
      const [rows] = await conn.query(
        'SELECT id, amount, status FROM commissions WHERE order_id = ?',
        [orderId]
      );
      const pending = rows.filter(r => r.status === 1);
      const withdrawn = rows.filter(r => r.status === 2);

      if (withdrawn.length > 0) {
        // 有已提现佣金：订单不可退款（需先撤回提现申请）
        console.warn(`[Commission revokeForOrder] 订单#${orderId} 有 ${withdrawn.length} 笔已提现佣金，拒绝退款`);
        if (!existingConn) { await conn.rollback(); conn.release(); }
        throw new Error('ORDER_HAS_WITHDRAWN_COMMISSIONS');
      }

      if (pending.length === 0) {
        // 无可撤销的佣金（可能已退款或从未结算），记录日志
        console.warn(`[Commission revokeForOrder] 订单#${orderId} 无可撤销的佣金记录`);
      } else {
        const ids = pending.map(r => r.id);
        await conn.execute(
          `UPDATE commissions SET status = 3 WHERE id IN (${ids.map(() => '?').join(',')})`,
          ids
        );
      }

      // 清除订单佣金结算标记（允许重新结算若订单重新确认）
      await conn.execute(
        'UPDATE orders SET commission_settled = 0 WHERE id = ?',
        [orderId]
      );
      if (shouldCommit) await conn.commit();
      if (shouldRelease) conn.release();
      return { revoked: pending.length, withdrawn: 0 };
    } catch (e) {
      // 仅在自主管理事务时回滚；若调用方传入 existingConn，则由调用方负责事务处理
      if (shouldCommit) await conn.rollback();
      if (shouldRelease) conn.release();
      throw e;
    }
  },

  /**
   * 提现拒绝时回滚佣金记录（status 2→1）
   * @param {object} conn - 数据库连接（必须在事务内）
   * @param {number} userId - 用户ID
   * @param {number} refundAmount - 需回滚的总金额
   * @returns {Promise<void>}
   */
  async revertForWithdraw(conn, userId, refundAmount) {
    // 按佣金记录 ID 倒序返还——先扣除（后产生）的记录先返还，避免返还已花销的旧记录
    const [commissions] = await conn.query(
      'SELECT id, amount FROM commissions WHERE user_id = ? AND status = 2 ORDER BY id DESC FOR UPDATE',
      [userId]
    );
    let remaining = refundAmount;
    for (const c of commissions) {
      if (remaining <= 0) break;
      const cAmt = parseFloat(c.amount);
      if (cAmt <= remaining) {
        await conn.execute('UPDATE commissions SET status = 1 WHERE id = ?', [c.id]);
        remaining = Math.round((remaining - cAmt) * 100) / 100;
      } else {
        const newAmt = Math.round((cAmt - remaining) * 100) / 100;
        await conn.execute('UPDATE commissions SET amount = ? WHERE id = ?', [newAmt, c.id]);
        remaining = 0;
      }
    }
  },

  /**
   * 批量结算多笔订单的佣金（用于 approve 时补偿历史订单）
   * 相比循环调 settleForOrder，将每订单 ~10 次 DB 查询合并为常数次。
   *
   * @param {number[]} orderIds - 订单 ID 数组
   * @param {object} conn - 数据库连接（必须在事务内）
   * @returns {Promise<number>} 实际结算的订单数
   */
  async settleForOrdersBatch(orderIds, conn) {
    if (!orderIds?.length) return 0;

    // 1. 批量幂等检查 + 读取订单/课程信息（单次 JOIN）
    const [orders] = await conn.query(
      `SELECT o.id, o.user_id, o.course_id, o.direct_agent_id, o.status, o.commission_settled,
              c.price, c.is_hot, c.hot_commission_rate
       FROM orders o
       JOIN courses c ON c.id = o.course_id
       WHERE o.id IN (${orderIds.map(() => '?').join(',')})
         AND o.status = 1 AND o.commission_settled = 0
       FOR UPDATE`,
      orderIds
    );
    if (!orders.length) return 0;

    // 2. 批量读取 agent_levels（单次查询，全量缓存）
    const [levelRows] = await conn.query(
      "SELECT level, rebate_rate, purchase_price FROM agent_levels"
    );
    const levelRates = {};
    levelRows.forEach(r => {
      levelRates[r.level] = parseFloat(r.rebate_rate) || 0;
      levelRates[`${r.level}_price`] = parseFloat(r.purchase_price) || 0;
    });

    // 3. 收集所有需查询的分销商 user_id（来自 direct_agent_id）
    const agentUserIds = [...new Set(orders.map(o => o.direct_agent_id).filter(Boolean))];
    if (!agentUserIds.length) return 0;

    // 4. 批量读取分销商链信息（单次 IN 查询 + 内存中建链）
    const [agentRows] = await conn.query(
      `SELECT a.user_id, a.level, a.status, t.parent_id
       FROM agents a
       LEFT JOIN teams t ON t.user_id = a.user_id
       WHERE a.user_id IN (${agentUserIds.map(() => '?').join(',')}) AND a.status = 1`,
      agentUserIds
    );
    const agentMap = {};
    agentRows.forEach(a => { agentMap[a.user_id] = a; });

    const settlements = [];

    for (const o of orders) {
      const chain = buildAgentChain(agentMap, o.direct_agent_id);
      const price = parseFloat(o.price);

      // 爆款课程：HOT_SALES 类型佣金
      if (o.is_hot === 1) {
        const hotRate = parseFloat(o.hot_commission_rate) || 0;
        if (hotRate > 0 && chain.L1) {
          const amount = Math.round(price * hotRate / 100 * 100) / 100;
          if (amount > 0) {
            await conn.execute(
              `INSERT INTO commissions (user_id, order_id, level, type, amount, profit_margin, status, created_at)
               VALUES (?, ?, 1, 'HOT_SALES', ?, ?, 1, NOW())`,
              [chain.L1.user_id, o.id, amount, amount]
            );
          }
        }
        continue;
      }

      // 普通课程差价佣金：只有 L1 获得
      if (chain.L1) {
        const purchasePrice = levelRates[`${chain.L1.level}_price`] || 0;
        const sourceType = o.agent_account_id ? 'purchase' : 'gift';
        const costPrice = sourceType === 'gift' ? 0 : purchasePrice;
        const profitMargin = Math.max(0, price - costPrice);
        const amount = Math.round(profitMargin * 100) / 100;
        if (amount > 0) {
          await conn.execute(
            `INSERT INTO commissions (user_id, order_id, level, type, amount, profit_margin, status, created_at)
             VALUES (?, ?, 1, 'SALES', ?, ?, 1, NOW())`,
            [chain.L1.user_id, o.id, amount, profitMargin]
          );
        }
      }
    }

    // 批量标记已结算（所有订单都标记，包括无佣金的）
    const settledOrderIds = orders.map(o => o.id);
    if (settledOrderIds.length) {
      await conn.execute(
        `UPDATE orders SET commission_settled = 1, confirm_time = NOW() WHERE id IN (${settledOrderIds.map(() => '?').join(',')})`,
        settledOrderIds
      );
    }

    return orders.length;
  },

  async listByUser(userId, { page = 1, pageSize = 20, type, status } = {}) {
    const offset = (page - 1) * pageSize;
    const conditions = ['c.user_id = ?'];
    const params = [userId];
    if (type)   { conditions.push("c.type = ?");    params.push(type); }
    if (status !== undefined) { conditions.push('c.status = ?'); params.push(status); }
    const where = conditions.join(' AND ');
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT c.*, o.id as order_id,
         co.title as course_title,
         o.total_amount as order_amount,
         CASE c.type WHEN 'SALES' THEN '销售佣金'
                     WHEN 'MANAGEMENT' THEN '管理奖'
                     WHEN 'REFERRAL' THEN '推荐奖励'
                     ELSE c.type END as type_text,
         CASE c.status WHEN 0 THEN '待处理'
                       WHEN 1 THEN '可提现'
                       WHEN 2 THEN '已提现'
                       WHEN 3 THEN '已撤销'
                       ELSE c.status END as status_text
         FROM commissions c
         LEFT JOIN orders o ON o.id = c.order_id
         LEFT JOIN courses co ON co.id = o.course_id
         WHERE ${where} ORDER BY c.id DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
      db.query(`SELECT COUNT(*) as cnt FROM commissions c WHERE ${where}`, params),
    ]);
    return { rows, total: total[0].cnt };
  },

  async stats(userId) {
    const [rows, todayRows] = await Promise.all([
      db.query(
        `SELECT status, SUM(amount) as total, COUNT(*) as cnt
         FROM commissions WHERE user_id = ? GROUP BY status`,
        [userId]
      ),
      db.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM commissions
         WHERE user_id = ? AND status = 1 AND DATE(created_at) = CURDATE()`,
        [userId]
      ),
    ]);
    const stats = { total: 0, available: 0, withdrawn: 0, revoked: 0, today_commission: 0 };
    rows.forEach(r => {
      stats.total += parseFloat(r.total || 0);
      // status: 1=已入账可提现, 2=已提现, 3=已撤销
      const s = Number(r.status);
      if (s === 1) stats.available += parseFloat(r.total || 0);
      if (s === 2) stats.withdrawn += parseFloat(r.total || 0);
      if (s === 3) stats.revoked += parseFloat(r.total || 0);
    });
    stats.today_commission = parseFloat(todayRows[0]?.total || 0);
    // 兼容前端字段名：前端期望 withdrawable / total_commission / balance / pending
    stats.withdrawable = stats.available;
    stats.total_commission = stats.total;
    stats.balance = stats.available;
    stats.pending = stats.available; // 待结算等同于可提现（佣金确认后即入账）
    return stats;
  },
};

/**
 * 从 direct_agent_id 向上追溯 L1/L2/L3 有效分销商
 * @param {number|null} directAgentId - 下单时的直接推广人 user_id
 * @param {number} buyerId - 购买人 user_id
 * @returns {Promise<{L1: object|null, L2: object|null, L3: object|null}>}
 */
// 内存中从 agentMap 构建 L1/L2/L3 链（settleForOrdersBatch 用）
function buildAgentChain(agentMap, startId) {
  const result = { L1: null, L2: null, L3: null };
  if (!startId) return result;
  const visited = new Set();
  let currentId = startId;
  let depth = 0;
  while (currentId && depth < 10 && !visited.has(currentId)) {
    visited.add(currentId);
    const a = agentMap[currentId];
    if (a) {
      const info = { user_id: a.user_id, level: a.level };
      if (!result.L1) result.L1 = info;
      else if (!result.L2) result.L2 = info;
      else if (!result.L3) { result.L3 = info; break; }
    }
    if (a?.parent_id == null) break;
    currentId = a?.parent_id;
    depth++;
  }
  return result;
}

async function resolveAgentChain(conn, directAgentId, buyerId) {
  const result = { L1: null, L2: null, L3: null };

  // directAgentId 是 agents.id，需要先找到对应的 user_id，再用 user_id 查 teams 表
  let startUserId = null;
  if (directAgentId) {
    const [directRows] = await conn.query(
      'SELECT user_id FROM agents WHERE id = ? AND status = 1 LIMIT 1',
      [directAgentId]
    );
    if (directRows[0]) {
      startUserId = directRows[0].user_id;
    }
  }

  // Fallback: if no directAgentId, start from buyer's teams parent
  if (!startUserId && buyerId) {
    const [teamRows] = await conn.query(
      'SELECT parent_id FROM teams WHERE user_id = ? LIMIT 1',
      [buyerId]
    );
    if (teamRows[0]?.parent_id != null) {
      startUserId = teamRows[0].parent_id;
    }
  }

  if (!startUserId) return result;

  // 追溯 teams 链，收集所有 user_id
  const userIds = new Set();
  const teamParentMap = {}; // user_id -> parent_user_id
  let currentUserId = startUserId;

  for (let depth = 0; depth < 10; depth++) {
    if (!currentUserId) break;
    userIds.add(currentUserId);
    const [parentRows] = await conn.query(
      'SELECT parent_id FROM teams WHERE user_id = ? LIMIT 1',
      [currentUserId]
    );
    if (!parentRows[0]?.parent_id) break;
    teamParentMap[currentUserId] = parentRows[0].parent_id;
    currentUserId = parentRows[0].parent_id;
  }

  if (userIds.size === 0) return result;

  // 一次查询所有相关的 agents（通过 user_id 集合）
  // mysql2 query() 不自动展开数组，需要用 apply 将数组元素作为独立参数传入
  const idsArray = [...userIds];
  const placeholders = idsArray.map(() => '?').join(',');
  const sql = `SELECT id, user_id, level FROM agents WHERE user_id IN (${placeholders}) AND status = 1`;
  let [agentRows] = await conn.query(sql, idsArray);
  if (agentRows.length === 0) {
    // fallback: 直接用 startUserId 查
    const [direct] = await conn.query('SELECT id, user_id, level FROM agents WHERE user_id = ? AND status = 1', [startUserId]);
    if (direct.length > 0) agentRows = direct;
  }

  // 建立 user_id -> agent 记录的映射
  const userIdToAgent = {};
  agentRows.forEach(a => { userIdToAgent[a.user_id] = a; });

  // 内存中按 teams 链顺序重建 L1/L2/L3
  currentUserId = startUserId;
  const visited = new Set();
  let depth = 0;
  while (currentUserId && depth < 10 && !visited.has(currentUserId)) {
    visited.add(currentUserId);
    const a = userIdToAgent[currentUserId];
    if (a && currentUserId !== buyerId) {
      const info = { user_id: a.user_id, level: a.level };
      if (!result.L1) result.L1 = info;
      else if (!result.L2) result.L2 = info;
      else if (!result.L3) { result.L3 = info; break; }
    }
    const parentUserId = teamParentMap[currentUserId];
    if (!parentUserId) break;
    currentUserId = parentUserId;
    depth++;
  }

  return result;
}

module.exports = Commission;
