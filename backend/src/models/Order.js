const db = require('../config/database');
const Commission = require('./Commission');

const Order = {
  // 创建订单（免费→status=1立即可用，付费→status=0待管理员确认）
  async create({ userId, courseId, agentId, promotionCodeId, directAgentId, type = 'course' }) {
    // 关联课程价格和是否免费
    const courseRows = await db.query('SELECT price, is_free FROM courses WHERE id = ? LIMIT 1', [courseId]);
    if (!courseRows.length) throw new Error('课程不存在');
    const { price, is_free } = courseRows[0];

    // 防重复购买：检查该用户是否已有已完成的同课程订单
    const existingOrders = await db.query(
      'SELECT id FROM orders WHERE user_id = ? AND course_id = ? AND status IN (1, 2) LIMIT 1',
      [userId, courseId]
    );
    if (existingOrders.length > 0) throw new Error('您已购买过该课程，请勿重复下单');

    const totalAmount = parseFloat(price) || 0;
    // 免费课程创建即确认（status=1），付费课程待管理员确认（status=0）
    const orderStatus = is_free === 1 ? 1 : 0;
    console.log(`[Order.create] userId=${userId}, courseId=${courseId}, directAgentId=${directAgentId}, agentId=${agentId}, orderStatus=${orderStatus}`);
    const finalDirectAgentId = directAgentId != null ? String(directAgentId) : null;
    const finalAgentId = agentId != null ? String(agentId) : null;
    console.log(`[Order.create] final values: direct_agent_id=${finalDirectAgentId}, agent_id=${finalAgentId}`);
    const r = await db.execute(
      `INSERT INTO orders (user_id, course_id, agent_id, promotion_code_id, type, status, direct_agent_id, total_amount, confirm_time, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${orderStatus === 1 ? 'NOW()' : 'NULL'}, NOW())`,
      [userId, courseId, finalAgentId, promotionCodeId || null, type, orderStatus, finalDirectAgentId, totalAmount]
    );
    console.log(`[Order.create] inserted order id=${r.insertId}, direct_agent_id=${finalDirectAgentId}`);
    // 免费课程创建即结算佣金（事务保证）
    if (orderStatus === 1) {
      const conn = await db.getConnection();
      try {
        await Commission.settleForOrder(r.insertId, conn);
      } finally {
        conn.release();
      }
    }
    return r.insertId;
  },

  async findById(id) {
    const rows = await db.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async listByUser(userId, { page = 1, pageSize = 20, status = null } = {}) {
    try {
      const offset = (page - 1) * pageSize;
      let where = 'WHERE o.user_id = ?';
      const params = [userId];

      // 状态过滤：前端传 "1,2" 表示已完成
      if (status !== null && status !== '' && status !== undefined) {
        const statuses = String(status).split(',').map(Number).filter(n => !isNaN(n));
        if (statuses.length === 1) {
          where += ' AND o.status = ?';
          params.push(statuses[0]);
        } else if (statuses.length > 1) {
          where += ` AND o.status IN (${statuses.map(() => '?').join(',')})`;
          params.push(...statuses);
        }
      }

      const [rows, total] = await Promise.all([
        db.query(
          `SELECT o.*, c.title as course_title, c.cover_image as course_cover
           FROM orders o
           LEFT JOIN courses c ON c.id = o.course_id
           ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
          [...params, pageSize, offset]
        ),
        db.query(`SELECT COUNT(*) as cnt FROM orders o ${where}`, params),
      ]);
      return { rows, total: total[0].cnt };
    } catch (err) {
      console.error('[Order.listByUser]', err);
      throw err;
    }
  },

  // 管理员确认订单（虚拟支付完成）
  async confirm(id) {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const [rows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
      if (!rows.length) { conn.rollback(); conn.release(); return null; }
      const order = rows[0];
      if (order.status !== 0) { conn.rollback(); conn.release(); return null; }
      // 归属校验：订单必须归属于真实用户
      if (!order.user_id) { conn.rollback(); conn.release(); return null; }
      // 幂等：只处理 status=0 的订单
      await conn.execute(
        'UPDATE orders SET status = 1, confirm_time = NOW() WHERE id = ? AND status = 0',
        [id]
      );
      // 结算佣金（L1/L2/L3 差额模式），复用 Order.confirm 的事务确保原子性
      // settleForOrder 内部会检查 commission_settled=0，幂等防重
      await Commission.settleForOrder(id, conn);
      await conn.commit();
      conn.release();
      return rows[0];
    } catch (e) {
      await conn.rollback();
      conn.release();
      throw e;
    }
  },

  // 订单超时关闭（定时任务：created_at < NOW() - 30min 且 status=0）
  async closeTimeout() {
    const [rows] = await db.query(
      `SELECT id, user_id, course_id, created_at FROM orders
       WHERE status = 0 AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
    );
    if (!rows.length) return 0;
    await db.query(
      `UPDATE orders SET status = 4
       WHERE status = 0 AND created_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)`
    );
    // 审计日志：记录每笔超时关闭的订单详情
    for (const o of rows) {
      const age = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);
      console.warn(`[OrderTimeout] 订单 #${o.id} 用户 #${o.user_id} 课程 #${o.course_id} 超时 ${age}min 已自动关闭`);
    }
    return rows.length;
  },

  // 管理员退款（status=1→3，调用 Commission.revokeForOrder 撤销佣金）
  async refund(id) {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      // 幂等检查：只有已结算的订单才能退款
      const [rows] = await conn.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
      if (!rows.length || rows[0].status !== 1) {
        await conn.rollback(); conn.release(); return null;
      }
      // 幂等检查：订单 status=1 但 commission_settled=0（未结算过佣金），无需撤销
      if (rows[0].commission_settled === 0) {
        await conn.rollback(); conn.release(); return rows[0];
      }
      await conn.execute('UPDATE orders SET status = 3 WHERE id = ? AND status = 1', [id]);
      await Commission.revokeForOrder(id, conn);
      await conn.commit();
      conn.release();
      return rows[0];
    } catch (e) {
      if (e.message === 'ORDER_HAS_WITHDRAWN_COMMISSIONS') {
        await conn.rollback(); conn.release();
        throw new Error('该订单有已提现的佣金，请先撤回提现申请后再退款');
      }
      await conn.rollback(); conn.release();
      throw e;
    }
  },
};
module.exports = Order;
