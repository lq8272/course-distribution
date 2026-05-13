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

module.exports = router;
