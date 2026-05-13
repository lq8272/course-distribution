const express = require('express');
const router = express.Router();
const Order = require('../../models/Order');
const db = require('../../config/database');
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/admin');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// POST /api/admin/order/:id/confirm 管理员确认虚拟订单
router.post('/:id/confirm', auth, adminAuth, async (req, res) => {
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
router.get('/list', auth, adminAuth, async (req, res) => {
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

module.exports = router;
