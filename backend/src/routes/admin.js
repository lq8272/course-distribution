const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Agent = require('../models/Agent');
const Order = require('../models/Order');
const Purchase = require('../models/Purchase');
const User = require('../models/User');
const Commission = require('../models/Commission');
const Notification = require('../models/Notification');
const SystemConfig = require('../models/SystemConfig');
const db = require('../config/database');
const config = require('../config');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/admin');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// POST /api/admin/login（R5：管理员密码登录，bcrypt校验）
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return fail(res, 400, 40000, '账号密码不能为空');

    // 直接用 username（手机号或编号）精确查管理员账号，无需遍历全表
    const user = await User.findAdminByCredentials(username, password);
    if (!user) return fail(res, 401, 40100, '账号或密码错误');

    const token = jwt.sign(
      { jti: crypto.randomUUID().replace(/-/g, ''), id: user.id, is_admin: true },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    ok(res, { token, user: { id: user.id, nickname: user.nickname, is_admin: true } });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '登录失败');
  }
});

// POST /api/admin/user/password 设置管理员密码（R5）
router.post('/user/password', auth, adminAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return fail(res, 400, 40000, '密码至少6位');
    const hashed = await new Promise((resolve, reject) => {
      bcrypt.hash(password, 10, (err, result) => {
        if (err) reject(err); else resolve(result);
      });
    });
    await User.updateAdminPassword(req.user.id, hashed);
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '设置失败');
  }
});

// GET /api/admin/agent/pending 审核列表
router.get('/agent/pending', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const result = await Agent.findPending({ page: parseInt(page), pageSize: parseInt(page_size) });
    ok(res, result);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/agent/:id/approve
router.post('/agent/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    const result = await Agent.approve(parseInt(req.params.id), req.user.id);
    if (!result) return fail(res, 400, 40000, '记录不存在或已被其他管理员处理');
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '审核失败');
  }
});

// POST /api/admin/agent/:id/reject
router.post('/agent/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    await Agent.reject(parseInt(req.params.id), req.user.id, reason || '');
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '操作失败');
  }
});

// GET /api/admin/agent/upgrade/pending 升级申请列表
router.get('/agent/upgrade/pending', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const result = await Agent.findPendingUpgrade({ page: parseInt(page), pageSize: parseInt(page_size) });
    ok(res, result);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/agent/upgrade/:id/approve 升级审核通过
router.post('/agent/upgrade/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    const result = await Agent.upgradeApprove(parseInt(req.params.id), req.user.id);
    if (!result) return fail(res, 400, 40000, '记录不存在或已被处理');
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '操作失败');
  }
});

// POST /api/admin/agent/upgrade/:id/reject 升级审核拒绝
router.post('/agent/upgrade/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    await Agent.upgradeReject(parseInt(req.params.id), req.user.id, reason || '');
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '操作失败');
  }
});

// POST /api/admin/order/:id/confirm 管理员确认虚拟订单
router.post('/order/:id/confirm', auth, adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Order.confirm(parseInt(id));
    if (!result) return fail(res, 404, 40400, '订单不存在');
    ok(res, { order_id: id });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '确认失败');
  }
});

// GET /api/admin/order/list
router.get('/order/list', auth, adminAuth, async (req, res) => {
  try {
    const { status, page = 1, page_size = 20 } = req.query;
    let where = '1=1';
    const params = [];
    if (status !== undefined && status !== '') { where += ' AND o.status = ?'; params.push(parseInt(status)); }
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT o.*, u.nickname as buyer_nickname, c.title as course_title
         FROM orders o LEFT JOIN users u ON u.id = o.user_id LEFT JOIN courses c ON c.id = o.course_id
         WHERE ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(page_size), offset]
      ),
      db.query(`SELECT COUNT(*) as cnt FROM orders o WHERE ${where}`, params),
    ]);
    ok(res, { rows, total: total[0].cnt });
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/admin/user/list
router.get('/user/list', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, keyword, agent_type = 'all' } = req.query;
    const result = await User.findAll({ page: parseInt(page), pageSize: parseInt(page_size), keyword, agentType: agent_type });
    ok(res, result);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/admin/user/stats 用户统计
router.get('/user/stats', auth, adminAuth, async (req, res) => {
  try {
    const [[totalUsers], [totalDistributor], levelRows] = await Promise.all([
      db.query('SELECT COUNT(*) as cnt FROM users WHERE is_admin = 0'),
      db.query('SELECT COUNT(*) as cnt FROM agents WHERE status = 1'),
      db.query('SELECT level, COUNT(*) as cnt FROM agents WHERE status = 1 GROUP BY level'),
    ]);
    const levelMap = {};
    (levelRows || []).forEach(r => { levelMap[r.level] = r.cnt; });
    ok(res, {
      total: totalUsers.cnt,
      distributor: totalDistributor.cnt,
      regular: totalUsers.cnt - totalDistributor.cnt,
      byLevel: levelMap,
    });
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/admin/withdraw/list
router.get('/withdraw/list', auth, adminAuth, async (req, res) => {
  try {
    const { status, page = 1, page_size = 20 } = req.query;
    let where = '1=1';
    const params = [];
    if (status !== undefined && status !== '') { where += ' AND w.status = ?'; params.push(parseInt(status)); }
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT w.*, u.nickname as user_nickname
         FROM withdraw_records w LEFT JOIN users u ON u.id = w.user_id
         WHERE ${where} ORDER BY w.id DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(page_size), offset]
      ),
      db.query(`SELECT COUNT(*) as cnt FROM withdraw_records w WHERE ${where}`, params),
    ]);
    ok(res, { rows, total: total[0]?.cnt || 0 });
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/withdraw/:id/approve
router.post('/withdraw/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      // FOR UPDATE 锁住记录，防止并发重复审批
      const [rows] = await conn.query(
        'SELECT * FROM withdraw_records WHERE id = ? AND status = 0 FOR UPDATE',
        [parseInt(req.params.id)]
      );
      if (!rows.length) {
        await conn.rollback(); conn.release();
        return fail(res, 400, 40000, '记录不存在或已处理');
      }
      // 审批通过：确认提现申请
      // 注意：用户申请提现时（commission/withdraw）已从 commissions 表扣减（status: 1→2），
      // 本步骤仅更新提现记录状态，不涉及余额操作
      await conn.execute(
        'UPDATE withdraw_records SET status = 1, handle_by = ?, handle_time = NOW() WHERE id = ?',
        [req.user.id, parseInt(req.params.id)]
      );
      await conn.commit();
      conn.release();
      // 发送站内通知
      Notification.send(rows[0].user_id, 'withdraw_approved', '提现申请已通过', {
        amount: rows[0].amount,
        withdraw_id: parseInt(req.params.id),
      });
      ok(res, null);
    } catch (e) {
      await conn.rollback(); conn.release();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '操作失败');
  }
});

// POST /api/admin/withdraw/:id/reject
router.post('/withdraw/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const { remark } = req.body;
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const [rows] = await conn.query(
        'SELECT * FROM withdraw_records WHERE id = ? AND status = 0 FOR UPDATE',
        [parseInt(req.params.id)]
      );
      if (!rows.length) {
        await conn.rollback(); conn.release();
        return fail(res, 400, 40000, '记录不存在或已处理');
      }
      // 拒绝时：资金释放 — 恢复佣金记录状态 2→1（已提现→已入账）
      const [withdrawRecord] = rows;
      const refundAmount = parseFloat(withdrawRecord.amount);
      // 按佣金记录 ID 倒序返还——先扣除（后产生）的记录先返还，避免返还已花销的旧记录
      const [commissions] = await conn.query(
        `SELECT id, amount FROM commissions WHERE user_id = ? AND status = 2 ORDER BY id DESC FOR UPDATE`,
        [withdrawRecord.user_id]
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
      await conn.execute(
        'UPDATE withdraw_records SET status = 2, handle_by = ?, handle_time = NOW(), remark = ? WHERE id = ?',
        [req.user.id, remark || '', parseInt(req.params.id)]
      );
      await conn.commit();
      conn.release();
      // 发送站内通知（退款至可提现余额）
      Notification.send(rows[0].user_id, 'withdraw_rejected', '提现申请已被拒绝', {
        amount: rows[0].amount,
        remark: remark || '',
        withdraw_id: parseInt(req.params.id),
      });
      ok(res, null);
    } catch (e) {
      await conn.rollback(); conn.release();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '操作失败');
  }
});

// GET /api/admin/config 获取所有系统配置
router.get('/config', auth, adminAuth, async (req, res) => {
  try {
    const configs = await SystemConfig.getAll();
    ok(res, configs);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/config 批量更新系统配置
router.post('/config', auth, adminAuth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return fail(res, 400, 40000, '参数格式错误');
    await SystemConfig.updateBatch(items);
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '保存失败');
  }
});

// GET /api/admin/stats/overview 概览统计
router.get('/stats/overview', auth, adminAuth, async (req, res) => {
  try {
    // 订单统计（已确认+已完成）
    const [orderStats] = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN (1,2) THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN status = 2 THEN total_amount ELSE 0 END) as completed_amount,
        SUM(CASE WHEN status IN (1,2) THEN total_amount ELSE 0 END) as confirmed_amount
      FROM orders
    `);
    // 佣金统计
    const [commissionStats] = await db.query(`
      SELECT
        COUNT(*) as total_commissions,
        SUM(CASE WHEN status = 1 THEN amount ELSE 0 END) as settled_amount,
        SUM(CASE WHEN status = 0 THEN amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 2 THEN amount ELSE 0 END) as withdrawn_amount
      FROM commissions WHERE type = 'SALES'
    `);
    // 提现统计
    const [withdrawStats] = await db.query(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 1 THEN amount ELSE 0 END) as approved_amount,
        SUM(CASE WHEN status = 0 THEN amount ELSE 0 END) as pending_amount
      FROM withdraw_records
    `);
    // 用户统计
    const [userStats] = await db.query(`
      SELECT
        COUNT(*) as total_users,
        (SELECT COUNT(*) FROM agents WHERE status = 1) as total_agents
    `);
    // 拿货统计
    const [purchaseStats] = await db.query(`
      SELECT
        COUNT(*) as total_purchases,
        SUM(CASE WHEN status = 1 THEN total_amount ELSE 0 END) as approved_amount,
        SUM(CASE WHEN status = 0 THEN total_amount ELSE 0 END) as pending_amount
      FROM purchase_records
    `);
    ok(res, {
      orders: {
        total: orderStats.total_orders || 0,
        confirmed: orderStats.confirmed_orders || 0,
        confirmedAmount: parseFloat(orderStats.confirmed_amount || 0),
        completedAmount: parseFloat(orderStats.completed_amount || 0),
      },
      commissions: {
        total: commissionStats.total_commissions || 0,
        settled: parseFloat(commissionStats.settled_amount || 0),
        pending: parseFloat(commissionStats.pending_amount || 0),
        withdrawn: parseFloat(commissionStats.withdrawn_amount || 0),
      },
      withdraw: {
        total: withdrawStats.total_requests || 0,
        approved: parseFloat(withdrawStats.approved_amount || 0),
        pending: parseFloat(withdrawStats.pending_amount || 0),
      },
      users: {
        total: userStats.total_users || 0,
        agents: userStats.total_agents || 0,
      },
      purchase: {
        total: purchaseStats.total_purchases || 0,
        approved: parseFloat(purchaseStats.approved_amount || 0),
        pending: parseFloat(purchaseStats.pending_amount || 0),
      },
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/admin/stats/sales 销售明细（按日/课程/等级）
router.get('/stats/sales', auth, adminAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query; // 7d, 30d, 90d, all
    let dateFilter = '';
    if (period === '7d') dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    else if (period === '30d') dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    else if (period === '90d') dateFilter = 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';

    // 按日统计
    const [dailyRows] = await db.query(`
      SELECT
        DATE(o.created_at) as date,
        COUNT(*) as order_count,
        SUM(CASE WHEN o.status IN (1,2) THEN o.total_amount ELSE 0 END) as amount
      FROM orders o
      WHERE 1=1 ${dateFilter}
      GROUP BY DATE(o.created_at)
      ORDER BY date DESC
      LIMIT 90
    `);
    // 按课程统计
    const [courseRows] = await db.query(`
      SELECT
        c.id, c.title,
        COUNT(o.id) as order_count,
        SUM(CASE WHEN o.status IN (1,2) THEN o.total_amount ELSE 0 END) as amount
      FROM orders o
      LEFT JOIN courses c ON c.id = o.course_id
      WHERE 1=1 ${dateFilter}
      GROUP BY c.id, c.title
      ORDER BY amount DESC
      LIMIT 20
    `);
    // 按等级统计
    const [levelRows] = await db.query(`
      SELECT
        a.level,
        COUNT(o.id) as order_count,
        SUM(CASE WHEN o.status IN (1,2) THEN o.total_amount ELSE 0 END) as amount
      FROM orders o
      LEFT JOIN agents a ON a.user_id = o.user_id AND a.status = 1
      WHERE 1=1 ${dateFilter}
      GROUP BY a.level
      ORDER BY amount DESC
    `);
    // 返佣统计
    const [rebateStats] = await db.query(`
      SELECT
        SUM(CASE WHEN status = 1 THEN amount ELSE 0 END) as total_rebate,
        SUM(CASE WHEN status = 0 THEN amount ELSE 0 END) as pending_rebate
      FROM commissions WHERE type = 'SALES' AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    `);
    ok(res, {
      daily: dailyRows,
      byCourse: courseRows,
      byLevel: levelRows,
      rebate: {
        total: parseFloat(rebateStats.total_rebate || 0),
        pending: parseFloat(rebateStats.pending_rebate || 0),
      },
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/admin/purchase/list 拿货记录列表
router.get('/purchase/list', auth, adminAuth, async (req, res) => {
  try {
    const { status, page = 1, page_size = 20 } = req.query;
    const result = await Purchase.findAll({ status: status !== undefined && status !== '' ? parseInt(status) : undefined, page: parseInt(page), pageSize: parseInt(page_size) });
    ok(res, result);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/purchase/:id/approve 审批通过
router.post('/purchase/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    await Purchase.approve(parseInt(req.params.id), req.user.id);
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, err.message || '操作失败');
  }
});

// POST /api/admin/purchase/:id/reject 审批拒绝
router.post('/purchase/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    await Purchase.reject(parseInt(req.params.id), req.user.id, reason || '');
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, err.message || '操作失败');
  }
});

module.exports = router;
