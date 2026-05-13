const express = require('express');
const router = express.Router();
const SystemConfig = require('../../models/SystemConfig');
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/admin');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/admin/config 获取所有系统配置
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const configs = await SystemConfig.getAll();
    ok(res, configs);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/config 批量更新系统配置
router.post('/', auth, adminAuth, async (req, res) => {
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

module.exports = router;
