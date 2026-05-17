const db = require('../config/database');
const { getRedis, REDIS_KEYS } = require('../config/redis');

/** 生成随机推广码（数字+字母） */
function generateCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const Agent = {
  // 查找用户当前有效的分销商申请
  async findActive(userId) {
    const rows = await db.query(
      'SELECT * FROM agents WHERE user_id = ? AND status = 1 LIMIT 1',
      [userId]
    );
    return rows[0] || null;
  },

  async findByUserId(userId) {
    const rows = await db.query('SELECT * FROM agents WHERE user_id = ? LIMIT 1', [userId]);
    return rows[0] || null;
  },

  async findPending({ page = 1, pageSize = 20 } = {}) {
    const offset = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT a.id, a.user_id, a.level, a.gift_quantity, a.recommender_id, a.status, a.created_at,
                u.nickname
         FROM agents a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.status = 0
         ORDER BY a.id ASC LIMIT ? OFFSET ?`,
        [pageSize, offset]
      ),
      db.query('SELECT COUNT(*) as cnt FROM agents WHERE status = 0'),
    ]);
    return { rows, total: total[0].cnt };
  },

  /**
   * 审核通过（完整流程 — 方案 5.9 节）
   *
   * 事务内完成：
   * 1. 更新 agents.status = 1
   * 2. 推荐人的 referral_count + 1
   * 3. 推荐人是 MXJ/CJHH 时初始化 gift_accounts_dr
   * 4. 写入 recommendation_rewards（一次性推荐奖励）
   * 5. 创建 teams 记录（parent_id = 推荐人，root_id = 自己）
   * 6. 递归向下更新所有 descendant 的 root_id = 自己
   */
  async approve(id, adminId) {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const [ag] = await conn.query('SELECT * FROM agents WHERE id = ? FOR UPDATE', [id]);
      if (!ag.length || ag[0].status !== 0) {
        await conn.rollback();
        conn.release();
        return null;
      }
      const agent = ag[0];

      // 1. 更新申请状态
      await conn.execute(
        'UPDATE agents SET status = 1, confirmed_by = ?, confirm_time = NOW() WHERE id = ?',
        [adminId, id]
      );

      // 2. 推荐人的 referral_count + 1（原子操作）
      if (agent.recommender_id) {
        await conn.execute(
          'UPDATE agents SET referral_count = referral_count + 1 WHERE user_id = ? AND status = 1',
          [agent.recommender_id]
        );

        // 3. 推荐人是 MXJ/CJHH → 初始化 gift_accounts_dr（仅当尚未初始化时）
        const [recAgent] = await conn.query(
          'SELECT user_id, level, gift_accounts_dr FROM agents WHERE user_id = ? AND status = 1 LIMIT 1',
          [agent.recommender_id]
        );
        if (recAgent.length && recAgent[0].gift_accounts_dr === 0) {
          const [levelCfg] = await conn.query(
            'SELECT gift_accounts FROM agent_levels WHERE level = ? LIMIT 1',
            [recAgent[0].level]
          );
          if (levelCfg.length && levelCfg[0].gift_accounts > 0) {
            await conn.execute(
              'UPDATE agents SET gift_accounts_dr = ? WHERE user_id = ?',
              [levelCfg[0].gift_accounts, agent.recommender_id]
            );
          }
        }

        // 4. 写入推荐奖励（一次性奖励，金额根据推荐人等级×被推荐人等级查 configs）
        //    key 格式: referral_reward_{inviter_level}_{invitee_level}（与 seed.sql 保持一致）
        //    例如: referral_reward_mxj_dr, referral_reward_cjhh_cjhh
        const inviterLevel = recAgent[0].level.toLowerCase(); // 推荐人等级 dr/mxj/cjhh
        const inviteeLevel = agent.level.toLowerCase();        // 被推荐人等级
        const rewardKey = `referral_reward_${inviterLevel}_${inviteeLevel}`;
        const [rewardCfg] = await conn.query(
          "SELECT value FROM configs WHERE `key` = ? LIMIT 1",
          [rewardKey]
        );
        const rewardAmount = rewardCfg.length ? parseFloat(rewardCfg[0].value) : 0;
        if (rewardAmount > 0) {
          await conn.execute(
            `INSERT INTO recommendation_rewards (inviter_id, invitee_id, reward_amount, status, created_at)
             VALUES (?, ?, ?, 1, NOW())`,
            [agent.recommender_id, agent.user_id, rewardAmount]
          );
        }
      }

      // 5. 创建或更新 teams 记录
      //    用户注册时已有一条 teams 记录（root_id=platform_root），审核通过时更新为正确值
      await conn.execute(
        `INSERT INTO teams (user_id, parent_id, root_id, created_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE parent_id = VALUES(parent_id), root_id = VALUES(root_id)`,
        [agent.user_id, agent.recommender_id || null, agent.user_id]
      );

      // 6. 生成推广码（一个用户一个码，level 字段表示分销等级）
      //    uk_user_id_level 唯一索引，同一用户的同一 level 只有一条记录
      //    使用 INSERT ... ON DUPLICATE KEY UPDATE 保证幂等：
      //    - 首次批准：INSERT 成功，写入新码
      //    - 重复申请再批准：UPDATE code 为本次新码（修复旧码停留 bug）
      const promoCode = generateCode(12);
      // 推广落地页域名从环境变量读取，支持 Docker / 本地灵活配置
      const promoBaseUrl = (process.env.PROMO_BASE_URL || 'https://course.example.com').trim().replace(/\/$/, '');
      const promoUrl = `${promoBaseUrl}/register?code=${promoCode}`;
      await conn.execute(
        `INSERT INTO promotion_codes (user_id, level, code, url, created_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE code = VALUES(code), url = VALUES(url)`,
        [agent.user_id, agent.level, promoCode, promoUrl]
      );
      console.log(`[approve] promotion_codes upserted for user_id=${agent.user_id}, code=${promoCode}`);

      // 7. 递归向下更新所有 descendant 的 root_id = 新分销商自己
      //    分批更新，每次最多 1000 条，防止深递归大事务
      await updateDescendantsRootId(conn, agent.user_id, agent.user_id);

      // 8. 补偿历史订单（批量结算，消除 N+1 查询）
      const [unsettledOrders] = await conn.query(
        `SELECT id FROM orders
         WHERE direct_agent_id = ? AND status = 1 AND commission_settled = 0
         LIMIT 500`,
        [agent.user_id]
      );
      if (unsettledOrders.length > 0) {
        const orderIds = unsettledOrders.map(r => r.id);
        const settled = await Commission.settleForOrdersBatch(orderIds, conn);
        console.log(`[approve] 批量补偿结算 ${settled} 笔历史订单，agent.user_id=${agent.user_id}`);
      }

      await conn.commit();
      conn.release();

      // 清除相关 Redis 缓存（审核通过后数据变更）
      // 事务已提交，此处失败不应影响已生效的审批结果
      try {
        const redis = getRedis();
        await redis.del(REDIS_KEYS.TEAM_OVERVIEW(agent.user_id));
        await redis.del(REDIS_KEYS.TEAM_TREE(agent.user_id));
        if (agent.recommender_id) {
          await redis.del(REDIS_KEYS.TEAM_OVERVIEW(agent.recommender_id));
          await redis.del(REDIS_KEYS.TEAM_TREE(agent.recommender_id));
        }
      } catch (redisErr) {
        console.warn('[approve] Redis缓存清理失败，不影响审批结果:', redisErr.message);
      }

      return agent;
    } catch (e) {
      await conn.rollback();
      conn.release();
      throw e;
    }
  },

  async reject(id, adminId, reason) {
    return db.execute(
      'UPDATE agents SET status = 2, confirmed_by = ?, confirm_time = NOW(), reject_reason = ? WHERE id = ?',
      [adminId, reason || '', id]
    );
  },

  // ==================== 升级审批 ====================

  // 查询待审核升级申请（分页）
  async findPendingUpgrade({ page = 1, pageSize = 20 } = {}) {
    const offset = (page - 1) * pageSize;
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT au.id, au.user_id, au.from_level, au.to_level, au.apply_fee, au.remark, au.created_at,
                u.nickname,
                a.referral_count
         FROM agent_upgrades au
         LEFT JOIN users u ON u.id = au.user_id
         LEFT JOIN agents a ON a.user_id = au.user_id AND a.status = 1
         WHERE au.status = 0
         ORDER BY au.id ASC LIMIT ? OFFSET ?`,
        [pageSize, offset]
      ),
      db.query('SELECT COUNT(*) as cnt FROM agent_upgrades WHERE status = 0'),
    ]);
    return { rows, total: total[0].cnt };
  },

  // 升级审核通过
  async upgradeApprove(id, adminId) {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const [upg] = await conn.query('SELECT * FROM agent_upgrades WHERE id = ? AND status = 0 FOR UPDATE', [id]);
      if (!upg.length) {
        await conn.rollback();
        conn.release();
        return null;
      }
      const upgrade = upg[0];

      // 1. 更新 agent_upgrades 状态
      await conn.execute(
        'UPDATE agent_upgrades SET status = 1, confirmed_by = ?, confirm_time = NOW() WHERE id = ?',
        [adminId, id]
      );

      // 2. 拿货数量校验（从 configs 表查目标等级的最低拿货要求）
      const toLevel = upgrade.to_level.toLowerCase();
      const [[agentRow]] = await conn.execute('SELECT total_purchase, referral_count FROM agents WHERE user_id = ? AND status = 1', [upgrade.user_id]);
      const [[cfg]] = await conn.execute("SELECT value FROM configs WHERE `key` = ?", [`min_purchase_qty_${toLevel}`]);
      const minPurchase = parseInt(cfg?.value || 0);
      if (minPurchase > 0 && (agentRow.total_purchase || 0) < minPurchase) {
        await conn.rollback();
        conn.release();
        throw new Error(`拿货数量不足，无法升级（需至少 ${minPurchase} 个，已完成 ${agentRow.total_purchase || 0} 个）`);
      }

      // 2b. 推荐人数校验（从 agent_levels 表查目标等级的 upgrade_referral_min）
      const [levelCfg] = await conn.query('SELECT upgrade_referral_min FROM agent_levels WHERE level = ? LIMIT 1', [upgrade.to_level]);
      if (!levelCfg?.length) {
        await conn.rollback();
        conn.release();
        throw new Error(`等级配置不存在: ${upgrade.to_level}，无法审核升级`);
      }
      const minReferrals = parseInt(levelCfg[0]?.upgrade_referral_min || 0);
      if (minReferrals > 0 && (agentRow.referral_count || 0) < minReferrals) {
        await conn.rollback();
        conn.release();
        throw new Error(`推荐人数不足，无法升级（需推荐至少 ${minReferrals} 人，已推荐 ${agentRow.referral_count || 0} 人）`);
      }

      // 3. 更新 agents.level 为新等级
      await conn.execute(
        'UPDATE agents SET level = ?, confirmed_by = ?, confirm_time = NOW() WHERE user_id = ? AND status = 1',
        [upgrade.to_level, adminId, upgrade.user_id]
      );

      // 4. 初始化新等级拿货名额（gift_accounts_dr = agent_levels.gift_accounts）
      const [levelRows] = await conn.query(
        'SELECT gift_accounts FROM agent_levels WHERE level = ? LIMIT 1',
        [upgrade.to_level]
      );
      if (levelRows.length && levelRows[0].gift_accounts > 0) {
        await conn.execute(
          'UPDATE agents SET gift_accounts_dr = ? WHERE user_id = ?',
          [levelRows[0].gift_accounts, upgrade.user_id]
        );
      }

      await conn.commit();
      conn.release();

      // 清除 Redis 缓存
      const redis = getRedis();
      await redis.del(REDIS_KEYS.TEAM_OVERVIEW(upgrade.user_id));
      await redis.del(REDIS_KEYS.TEAM_TREE(upgrade.user_id));

      return upgrade;
    } catch (e) {
      await conn.rollback();
      conn.release();
      throw e;
    }
  },

  // 升级审核拒绝
  async upgradeReject(id, adminId, reason) {
    return db.execute(
      'UPDATE agent_upgrades SET status = 2, confirmed_by = ?, confirm_time = NOW(), reject_reason = ? WHERE id = ?',
      [adminId, reason || '', id]
    );
  },

  async create({ userId, level, giftQuantity, recommenderId }) {
    // 使用 INSERT ... ON DUPLICATE KEY UPDATE 支持 rejected 后重新申请：
    // - 首次申请：INSERT 成功，status=0
    // - rejected 再申请：UPDATE status=0，level/gift_quantity 同步更新
    await db.query(
      `INSERT INTO agents (user_id, level, gift_quantity, recommender_id, status, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())
       ON DUPLICATE KEY UPDATE
         status   = VALUES(status),
         level    = VALUES(level),
         gift_quantity = VALUES(gift_quantity),
         recommender_id = VALUES(recommender_id),
         confirmed_by   = NULL,
         confirm_time   = NULL,
         reject_reason  = NULL`,
      [Number(userId), String(level), Number(giftQuantity || 0), recommenderId ? Number(recommenderId) : null]
    );
    const rows = await db.query('SELECT id FROM agents WHERE user_id = ? LIMIT 1', [Number(userId)]);
    return Number(rows[0].id);
  },
};

/**
 * BFS 向下更新所有 descendant 的 root_id（正确遍历全树，不依赖 root_id 筛选）
 * @param {object} conn - MySQL 连接
 * @param {number} newRootId - 新 root_id（新审核通过的分销商）
 * @param {number} startUserId - 起始节点（就是新分销商自己）
 */
async function updateDescendantsRootId(conn, newRootId, startUserId) {
  const queue = [startUserId];
  let processed = 0;

  while (queue.length > 0) {
    // 批量出队（每次处理一层）
    const batchIds = queue.splice(0, 500);
    if (!batchIds.length) break;

    // 查找这些节点的全部直接子节点
    const placeholders = batchIds.map(() => '?').join(',');
    const [children] = await conn.query(
      `SELECT user_id FROM teams WHERE parent_id IN (${placeholders})`,
      batchIds
    );

    if (!children.length) break;

    const childIds = children.map(r => r.user_id);
    // 批量更新这批子节点的 root_id
    const childPlaceholders = childIds.map(() => '?').join(',');
    await conn.execute(
      `UPDATE teams SET root_id = ? WHERE user_id IN (${childPlaceholders}) AND root_id != ?`,
      [newRootId, newRootId, ...childIds]
    );

    // 子节点入队，继续向下遍历
    queue.push(...childIds);
    processed += childIds.length;

    // 安全保护：超过 10000 人为异常，强制停止（防止循环引用攻击）
    if (processed > 10000) {
      console.warn(`[updateDescendantsRootId] 超出安全上限 10000 人，强制停止`);
      break;
    }
  }
}

module.exports = Agent;
