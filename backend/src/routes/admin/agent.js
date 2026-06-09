const express = require('express');
const router = express.Router();
const Agent = require('../../models/Agent');
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/admin');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/admin/agent/pending 审核列表
router.get('/pending', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const result = await Agent.findPending({ page: parseInt(page), pageSize: parseInt(page_size) });
    ok(res, result);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/agent/:id/approve
router.post('/:id/approve', auth, adminAuth, async (req, res) => {
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
router.post('/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    await Agent.reject(parseInt(req.params.id), req.user.id, reason || '');
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '操作失败');
  }
});

// GET /api/admin/agent/upgrade/pending 升级申请列表
router.get('/upgrade/pending', auth, adminAuth, async (req, res) => {
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
router.post('/upgrade/:id/approve', auth, adminAuth, async (req, res) => {
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
router.post('/upgrade/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    await Agent.upgradeReject(parseInt(req.params.id), req.user.id, reason || '');
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '操作失败');
  }
});

// POST /api/admin/agent/account/allocate 分配账号给客户
// Body: { agent_id, customer_user_id }
router.post('/account/allocate', auth, adminAuth, async (req, res) => {
  try {
    const { agent_id, customer_user_id } = req.body;
    if (!agent_id) return fail(res, 400, 40000, '请提供分销商ID');
    if (!customer_user_id) return fail(res, 400, 40000, '请提供客户ID');

    // 验证分销商存在
    const db = require('../../config/database');
    const [agents] = await db.query(
      'SELECT id, user_id, level, gift_accounts_dr, gift_used FROM agents WHERE id = ? AND status = 1 LIMIT 1',
      [agent_id]
    );
    if (!agents.length) return fail(res, 400, 40000, '分销商不存在');
    const agent = agents[0];

    // 检查剩余赠送名额
    const remaining = (agent.gift_accounts_dr || 0) - (agent.gift_used || 0);
    if (remaining <= 0) return fail(res, 400, 40000, '该分销商赠送名额已用完，请先差价拿货');

    // 查找客户信息
    const [users] = await db.query('SELECT id, nickname FROM users WHERE id = ? LIMIT 1', [customer_user_id]);
    if (!users.length) return fail(res, 400, 40000, '客户不存在');

    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      // 写入账号分配记录
      const [result] = await conn.execute(
        `INSERT INTO agent_accounts (agent_id, customer_user_id, account_name, source_type, status, created_at)
         VALUES (?, ?, ?, 'gift', 1, NOW())`,
        [agent_id, customer_user_id, users[0].nickname || `客户${customer_user_id}`]
      );

      // 扣减赠送名额
      await conn.execute(
        'UPDATE agents SET gift_used = gift_used + 1 WHERE id = ?',
        [agent_id]
      );

      await conn.commit();
      conn.release();
      ok(res, { id: result.insertId });
    } catch (e) {
      await conn.rollback();
      conn.release();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '分配失败');
  }
});

// POST /api/admin/agent/account/purchase 差价拿货（分销商赊账购买账号）
// Body: { agent_id, quantity }
router.post('/account/purchase', auth, adminAuth, async (req, res) => {
  try {
    const { agent_id, quantity } = req.body;
    if (!agent_id) return fail(res, 400, 40000, '请提供分销商ID');
    const qty = parseInt(quantity) || 0;
    if (qty <= 0) return fail(res, 400, 40000, '数量需大于0');

    const db = require('../../config/database');
    const [agents] = await db.query(
      'SELECT id, user_id, level FROM agents WHERE id = ? AND status = 1 LIMIT 1',
      [agent_id]
    );
    if (!agents.length) return fail(res, 400, 40000, '分销商不存在');
    const agent = agents[0];

    // 查拿货价
    const [levels] = await db.query(
      'SELECT purchase_price, min_purchase_qty FROM agent_levels WHERE level = ? LIMIT 1',
      [agent.level]
    );
    if (!levels.length) return fail(res, 400, 40000, '等级配置异常');
    const { purchase_price, min_purchase_qty } = levels[0];
    if (qty < min_purchase_qty) return fail(res, 400, 40000, `最低拿货量为${min_purchase_qty}个`);

    const totalAmount = purchase_price * qty;

    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      // 记录赊账购买
      const [result] = await conn.execute(
        `INSERT INTO agent_purchases (agent_id, quantity, unit_price, total_amount, status, created_at)
         VALUES (?, ?, ?, ?, 0, NOW())`,
        [agent_id, qty, purchase_price, totalAmount]
      );

      // 创建账号记录（批量）
      for (let i = 0; i < qty; i++) {
        await conn.execute(
          `INSERT INTO agent_accounts (agent_id, source_type, status, created_at)
           VALUES (?, 'purchase', 0, NOW())`,
          [agent_id]
        );
      }

      // 更新分销商累计拿货量
      await conn.execute(
        'UPDATE agents SET total_purchase = total_purchase + ? WHERE id = ?',
        [qty, agent_id]
      );

      await conn.commit();
      conn.release();
      ok(res, { id: result.insertId, total_amount: totalAmount });
    } catch (e) {
      await conn.rollback();
      conn.release();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '拿货失败');
  }
});

// GET /api/admin/agent/:id/accounts 查询分销商账号列表
router.get('/:id/accounts', auth, adminAuth, async (req, res) => {
  try {
    const db = require('../../config/database');
    const { page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);

    const [rows] = await db.query(
      `SELECT aa.*, u.nickname as customer_name
       FROM agent_accounts aa
       LEFT JOIN users u ON u.id = aa.customer_user_id
       WHERE aa.agent_id = ?
       ORDER BY aa.id DESC LIMIT ? OFFSET ?`,
      [req.params.id, parseInt(page_size), offset]
    );
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM agent_accounts WHERE agent_id = ?',
      [req.params.id]
    );
    ok(res, { rows, total });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

module.exports = router;
