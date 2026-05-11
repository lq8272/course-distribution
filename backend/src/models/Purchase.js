const db = require('../config/database');
const { getRedis, REDIS_KEYS } = require('../config/redis');

const Purchase = {
  /** 用户申请拿货 */
  async apply(userId, { quantity }) {
    if (!quantity || quantity <= 0) throw new Error('请输入有效数量');

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 查询用户等级（取正式状态的分销商）
      const [agent] = await conn.execute(
        'SELECT level FROM agents WHERE user_id = ? AND status = 1 LIMIT 1',
        [userId]
      );
      if (!agent) throw new Error('您还不是正式分销商，无法拿货');

      const level = agent.level;

      // 查询等级拿货配置（从 configs 表，用独立连接避免事务内问题）
      const lv = level.toLowerCase();
      const key1 = `purchase_price_${lv}`;
      const key2 = `min_purchase_qty_${lv}`;
      const cfgRows = await db.query(
        "SELECT `key`, value FROM configs WHERE `key` IN (?, ?)",
        [key1, key2]
      );
      const cfgMap = {};
      cfgRows.forEach(r => { cfgMap[r.key] = r.value; });
      const unitPrice = cfgMap[`purchase_price_${lv}`];
      const minQty = parseInt(cfgMap[`min_purchase_qty_${lv}`]);
      if (!unitPrice || isNaN(minQty)) throw new Error('等级拿货配置不存在');

      if (quantity < minQty) throw new Error(`最低拿货数量为 ${minQty} 个`);

      const totalAmount = (parseFloat(unitPrice) * quantity).toFixed(2);

      const [[existing]] = await conn.execute(
        `SELECT id FROM purchase_records WHERE user_id = ? AND status = 0 LIMIT 1`,
        [userId]
      );
      if (existing) throw new Error('您有待审核的拿货申请，请等待处理');

      const [result] = await conn.execute(
        `INSERT INTO purchase_records (user_id, quantity, unit_price, total_amount, status)
         VALUES (?, ?, ?, ?, 0)`,
        [userId, quantity, unitPrice, totalAmount]
      );

      await conn.commit();
      return { id: result.insertId, quantity, unit_price: unitPrice, total_amount: totalAmount };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** 管理员通过拿货申请（发放佣金给推荐人） */
  async approve(id, adminId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [[record]] = await conn.execute(
        'SELECT * FROM purchase_records WHERE id = ? AND status = 0 FOR UPDATE',
        [id]
      );
      if (!record) throw new Error('记录不存在或已处理');

      // 更新状态为已确认
      await conn.execute(
        'UPDATE purchase_records SET status = 1, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
        [adminId, id]
      );

      // 查询购买人信息（用于计算佣金）
      const [[buyer]] = await conn.execute(
        'SELECT a.level, a.recommender_id FROM agents a WHERE a.user_id = ? AND a.status = 1 LIMIT 1',
        [record.user_id]
      );
      if (buyer && buyer.recommender_id) {
        // 查询推荐人等级
        const [[referrer]] = await conn.execute(
          'SELECT level FROM agents WHERE user_id = ? AND status = 1 LIMIT 1',
          [buyer.recommender_id]
        );
        if (referrer) {
          // 查询佣金比例（从 configs 表查 referral_reward_{inviter}_{invitee}）
          const cfgKey = `referral_reward_${referrer.level.toLowerCase()}_${buyer.level.toLowerCase()}`;
          const [[cfgRow]] = await conn.execute(
            "SELECT value FROM configs WHERE `key` = ? LIMIT 1",
            [cfgKey]
          );
          const rewardValue = parseFloat(cfgRow?.value || 0);
          if (rewardValue > 0) {
            await conn.execute(
              `INSERT INTO commissions (user_id, order_id, type, level, amount, status, remark)
               VALUES (?, ?, 'purchase_commission', ?, ?, 1, '拿货佣金')`,
              [buyer.recommender_id, record.id, buyer.level, rewardValue]
            );
          }
        }
      }

      await conn.commit();

      // 清除推荐人佣金统计缓存
      if (buyer && buyer.recommender_id) {
        await getRedis().del(REDIS_KEYS.COMMISSION_STATS(buyer.recommender_id));
      }

      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** 管理员拒绝拿货申请 */
  async reject(id, adminId, reason = '') {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[record]] = await conn.execute(
        'SELECT * FROM purchase_records WHERE id = ? AND status = 0 FOR UPDATE',
        [id]
      );
      if (!record) throw new Error('记录不存在或已处理');

      await conn.execute(
        'UPDATE purchase_records SET status = 2, reviewed_by = ?, reviewed_at = NOW(), remark = ? WHERE id = ?',
        [adminId, reason, id]
      );
      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /** 用户查询自己的拿货记录 */
  async findByUser(userId, { page = 1, pageSize = 20 } = {}) {
    const offset = (page - 1) * pageSize;
    const [rows, [totalRow]] = await Promise.all([
      db.query(
        `SELECT id, quantity, unit_price, total_amount, status, reviewed_at, created_at,
                CASE status WHEN 0 THEN '待审核' WHEN 1 THEN '已确认' WHEN 2 THEN '已拒绝' ELSE '未知' END as status_text
         FROM purchase_records WHERE user_id = ?
         ORDER BY id DESC LIMIT ? OFFSET ?`,
        [userId, pageSize, offset]
      ),
      db.query('SELECT COUNT(*) as cnt FROM purchase_records WHERE user_id = ?', [userId]),
    ]);
    return { rows, total: totalRow.cnt };
  },

  /** 管理员分页查询待审核 */
  async findPending({ page = 1, pageSize = 20 } = {}) {
    const offset = (page - 1) * pageSize;
    const [rows, [totalRow]] = await Promise.all([
      db.query(
        `SELECT pr.*, u.nickname, u.openid,
                a.level as buyer_level, a.nickname as buyer_nickname,
                0 as purchase_price, 0 as min_purchase_qty
         FROM purchase_records pr
         LEFT JOIN users u ON u.id = pr.user_id
         LEFT JOIN agents a ON a.user_id = pr.user_id AND a.status = 1
         WHERE pr.status = 0
         ORDER BY pr.id ASC LIMIT ? OFFSET ?`,
        [pageSize, offset]
      ),
      db.query('SELECT COUNT(*) as cnt FROM purchase_records WHERE status = 0'),
    ]);
    return { rows, total: totalRow.cnt };
  },

  /** 管理员查询所有拿货记录（支持状态筛选） */
  async findAll({ status, page = 1, pageSize = 20 } = {}) {
    const offset = (page - 1) * pageSize;
    let where = '1=1';
    const params = [];
    if (status !== undefined) { where += ' AND pr.status = ?'; params.push(status); }
    const [rows, [totalRow]] = await Promise.all([
      db.query(
        `SELECT pr.*, u.nickname as buyer_nickname,
                a.level as buyer_level
         FROM purchase_records pr
         LEFT JOIN users u ON u.id = pr.user_id
         LEFT JOIN agents a ON a.user_id = pr.user_id AND a.status = 1
         WHERE ${where}
         ORDER BY pr.id DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
      db.query(`SELECT COUNT(*) as cnt FROM purchase_records pr WHERE ${where}`, params),
    ]);
    return { rows, total: totalRow.cnt };
  },
};

module.exports = Purchase;
