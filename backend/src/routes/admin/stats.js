const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/admin');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/admin/stats/overview 概览统计
router.get('/overview', auth, adminAuth, async (req, res) => {
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
router.get('/sales', auth, adminAuth, async (req, res) => {
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

module.exports = router;
