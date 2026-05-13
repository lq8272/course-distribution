const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const db = require('../../config/database');
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/admin');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/admin/user/list
router.get('/list', auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, keyword, agent_type = 'all' } = req.query;
    const result = await User.findAll({ page: parseInt(page), pageSize: parseInt(page_size), keyword, agentType: agent_type });
    ok(res, result);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/admin/user/stats 用户统计
router.get('/stats', auth, adminAuth, async (req, res) => {
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

module.exports = router;
