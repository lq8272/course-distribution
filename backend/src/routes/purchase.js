const express = require('express');
const router = express.Router();
const Purchase = require('../models/Purchase');
const db = require('../config/database');
const auth = require('../middleware/auth');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// POST /api/purchase/apply  用户申请拿货
router.post('/apply', auth, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity) return fail(res, 400, 40000, '请填写拿货数量');
    const result = await Purchase.apply(req.user.id, { quantity: parseInt(quantity) });
    ok(res, result);
  } catch (err) {
    const msg = err.message || '申请失败';
    return fail(res, 400, 40001, msg);
  }
});

// GET /api/purchase/records  用户拿货记录
router.get('/records', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const result = await Purchase.findByUser(req.user.id, {
      page: parseInt(page),
      pageSize: parseInt(page_size),
    });
    ok(res, result);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/purchase/config  用户拿货配置（价格+最低数量）
router.get('/config', auth, async (req, res) => {
  try {
    // db.execute() 返回查询结果行（数组），单行查询也是数组
    const rows = await db.execute(
      'SELECT level FROM agents WHERE user_id = ? AND status = 1 LIMIT 1',
      [req.user.id]
    );
    if (!rows.length) return ok(res, null);
    const level = rows[0].level;
    const cfgRows = await db.execute(
      "SELECT `key`, value FROM configs WHERE `key` IN (?, ?, ?)",
      [`purchase_price_${level.toLowerCase()}`, `min_purchase_qty_${level.toLowerCase()}`, 'product_name']
    );
    const cfgMap = {};
    cfgRows.forEach(r => { cfgMap[r.key] = r.value; });
    const lv = level.toLowerCase();
    ok(res, {
      level,
      product_name: cfgMap['product_name'] || '视频课程',
      purchase_price: cfgMap[`purchase_price_${lv}`] || '0',
      min_purchase_qty: parseInt(cfgMap[`min_purchase_qty_${lv}`]) || 0,
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

module.exports = router;
