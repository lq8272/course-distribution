const express = require('express');
const router = express.Router();
const Purchase = require('../../models/Purchase');
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/admin');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/admin/purchase/list 拿货记录列表
router.get('/list', auth, adminAuth, async (req, res) => {
  try {
    const { status, page = 1, page_size = 20 } = req.query;
    const result = await Purchase.findAll({ status: status !== undefined && status !== '' ? parseInt(status) : undefined, page: parseInt(page), pageSize: parseInt(page_size) });
    ok(res, result);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/purchase/:id/approve 审批通过
router.post('/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    await Purchase.approve(parseInt(req.params.id), req.user.id);
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, err.message || '操作失败');
  }
});

// POST /api/admin/purchase/:id/reject 审批拒绝
router.post('/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    await Purchase.reject(parseInt(req.params.id), req.user.id, reason || '');
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '操作失败');
  }
});

module.exports = router;
