const db = require('../config/database');

const Commission = {
  /**
   * 订单确认后自动结算佣金 — 差额模式
   *
   * 方案 5.1 差额模式说明：
   * - L1 直推达人：拿课程价格 × L1_rate
   * - L2 上级梦想家：拿课程价格 × (L2_rate - L1_rate)，仅当 L2_rate > L1_rate
   * - L3 上上级超合伙：拿课程价格 × (L3_rate - L2_rate)，仅当 L3_rate > L2_rate
   *
   * 佣金直接写入 status=1（已入账/可提现），不在事务外可见中间状态。
   *
   * @param {number} orderId - 订单 ID
   * @param {object} [existingConn] - 可选，若传入则复用该连接的事务（确保原子性）
   */
  async settleForOrder(orderId, existingConn = null) {
    const shouldRelease = existingConn === null;
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
      const [course] = await conn.query('SELECT price FROM courses WHERE id = ?', [o.course_id]);
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
      const agentsChain = await resolveAgentChain(conn, o.direct_agent_id, o.user_id);

      // 4. 读取各级分销商的 rebate_rate（从 agent_levels 表动态获取）
      const levelRates = { DR: 0, MXJ: 0, CJHH: 0 };
      const [rateRows] = await conn.query(
        "SELECT level, rebate_rate FROM agent_levels WHERE level IN ('DR','DISTRIBUTORDR','MXJ','DISTRIBUTORMXJ','CJHH','DISTRIBUTORCJHH')"
      );
      rateRows.forEach(r => { levelRates[r.level] = parseFloat(r.rebate_rate) || 0; });

      const settlements = [];

      // 5. 计算并写入每层佣金（SALES 类型）— 差额返佣模式
      //    L1 达人：拿自己等级对应 rebate_rate × 课程价格
      //    L2 梦想家：拿 (L2_rate - L1_rate) × 课程价格，仅当差值为正
      //    L3 超合伙：拿 (L3_rate - L2_rate) × 课程价格，仅当差值为正
      if (agentsChain.L1) {
        const rate1 = levelRates[agentsChain.L1.level] ?? 0;
        const amount = Math.round(price * rate1 * 100) / 100;
        if (amount > 0) {
          await conn.execute(
            `INSERT INTO commissions (user_id, order_id, level, type, amount, status, created_at)
             VALUES (?, ?, 1, 'SALES', ?, 1, NOW())`,
            [agentsChain.L1.user_id, orderId, amount]
          );
          settlements.push({ userId: agentsChain.L1.user_id, level: 1, amount });
        }
      }

      if (agentsChain.L2) {
        const rate2 = levelRates[agentsChain.L2.level] ?? 0;
        const rate1 = levelRates[agentsChain.L1?.level] ?? 0;
        const diffRate = Math.max(0, rate2 - rate1);
        const amount = Math.round(price * diffRate * 100) / 100;
        if (amount > 0) {
          await conn.execute(
            `INSERT INTO commissions (user_id, order_id, level, type, amount, status, created_at)
             VALUES (?, ?, 2, 'SALES', ?, 1, NOW())`,
            [agentsChain.L2.user_id, orderId, amount]
          );
          settlements.push({ userId: agentsChain.L2.user_id, level: 2, amount });
        }
      }

      if (agentsChain.L3) {
        const rate3 = levelRates[agentsChain.L3.level] ?? 0;
        const rate2 = levelRates[agentsChain.L2?.level] ?? 0;
        const diffRate = Math.max(0, rate3 - rate2);
        const amount = Math.round(price * diffRate * 100) / 100;
        if (amount > 0) {
          await conn.execute(
            `INSERT INTO commissions (user_id, order_id, level, type, amount, status, created_at)
             VALUES (?, ?, 3, 'SALES', ?, 1, NOW())`,
            [agentsChain.L3.user_id, orderId, amount]
          );
          settlements.push({ userId: agentsChain.L3.user_id, level: 3, amount });
        }
      }

      // 6. 推荐奖励：direct_agent_id 对应的直推分销商获得固定金额奖励
      //    奖励规则根据（推荐人等级, 购买人身份）查 configs
      //    - 达人推荐达人购买：referral_reward_dr_dr = 0（已达人已通过SALES获得30%）
      //    - 达人推荐梦想家/超级合伙人购买：referral_reward_dr_mxj / _cjhh = 3000
      //    - 梦想家推荐达人购买：referral_reward_mxj_dr = 5000
      //    - 以此类推，共9种组合
      if (agentsChain.L1) {
        // 判断购买人身份（是否本身是分销商）
        const [buyerAgent] = await conn.query(
          'SELECT level FROM agents WHERE user_id = ? AND status = 1 LIMIT 1',
          [o.user_id]
        );
        const buyerLevel = buyerAgent.length ? buyerAgent[0].level : 'DR'; // 默认为DR（普通用户）
        const cfgKey = `referral_reward_${agentsChain.L1.level.toLowerCase()}_${buyerLevel.toLowerCase()}`;
        const [cfg] = await conn.query(
          "SELECT value FROM configs WHERE `key` = ? LIMIT 1",
          [cfgKey]
        );
        const referralReward = parseFloat(cfg[0]?.value || 0);
        if (referralReward > 0) {
          await conn.execute(
            `INSERT INTO commissions (user_id, order_id, level, type, amount, status, created_at)
             VALUES (?, ?, 1, 'REFERRAL', ?, 1, NOW())`,
            [agentsChain.L1.user_id, orderId, referralReward]
          );
        }
      }

      // 7. 标记订单佣金已结算（幂等）
      await conn.execute(
        'UPDATE orders SET commission_settled = 1, confirm_time = NOW() WHERE id = ?',
        [orderId]
      );

      await conn.commit();
      if (shouldRelease) conn.release();
      return settlements;
    } catch (e) {
      await conn.rollback();
      if (shouldRelease) conn.release();
      throw e;
    }
  },

  /**
   * 订单退款/取消时撤销佣金（status=1→3）
   * @param {number} orderId - 订单 ID
   * @param {object} [existingConn] - 可选外部连接（复用事务）
   */
  async revokeForOrder(orderId, existingConn = null) {
    const shouldRelease = existingConn === null;
    const conn = existingConn || await db.getConnection();
    if (!existingConn) await conn.beginTransaction();
    try {
      const [rows] = await conn.query(
        'SELECT id, amount FROM commissions WHERE order_id = ? AND status = 1 FOR UPDATE',
        [orderId]
      );
      if (rows.length) {
        const ids = rows.map(r => r.id);
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
      await conn.commit();
      if (shouldRelease) conn.release();
    } catch (e) {
      await conn.rollback();
      if (shouldRelease) conn.release();
      throw e;
    }
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
async function resolveAgentChain(conn, directAgentId, buyerId) {
  const result = { L1: null, L2: null, L3: null };

  // Fallback: if no directAgentId, start from buyer's teams parent
  // conn.query returns [rows, fields]; rows = [{parent_id: N}]
  let startId = directAgentId;
  if (!startId && buyerId) {
    const teamRows = await conn.query(
      'SELECT parent_id FROM teams WHERE user_id = ? LIMIT 1',
      [buyerId]
    );
    const firstRow = teamRows[0]?.[0];
    if (firstRow?.parent_id != null) {
      startId = firstRow.parent_id;
    }
  }

  if (!startId) return result;

  const visited = new Set();
  let currentId = startId;
  let depth = 0;

  while (currentId && depth < 10 && !visited.has(currentId)) {
    visited.add(currentId);
    if (currentId !== buyerId) {
      const [agentRows] = await conn.query(
        'SELECT user_id, level FROM agents WHERE user_id = ? AND status = 1 LIMIT 1',
        [currentId]
      );
      if (agentRows?.length) {
        const info = { user_id: agentRows[0].user_id, level: agentRows[0].level };
        if (!result.L1) result.L1 = info;
        else if (!result.L2) result.L2 = info;
        else if (!result.L3) { result.L3 = info; break; }
      }
    }

    // 继续向上查 parent
    const [parentRows] = await conn.query(
      'SELECT parent_id FROM teams WHERE user_id = ? LIMIT 1',
      [currentId]
    );
    if (!parentRows?.length || parentRows[0].parent_id == null) break;
    currentId = parentRows[0].parent_id;
    depth++;
  }

  return result;
}

module.exports = Commission;
