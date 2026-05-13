const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Agent = require('../models/Agent');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { getRedis, REDIS_KEYS } = require('../config/redis');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/team/overview
router.get('/overview', auth, async (req, res) => {
  try {
    const redis = getRedis();
    const cacheKey = REDIS_KEYS.TEAM_OVERVIEW(req.user.id);
    let cached = null;
    try {
      cached = await redis.get(cacheKey);
    } catch (_) {}
    if (cached) return ok(res, JSON.parse(cached));

    const agent = await Agent.findActive(req.user.id);
    if (!agent) return ok(res, { is_agent: false });

    // 补充等级名称（db.query 返回 [row]）
    const levelRows = await db.query(
      'SELECT name FROM agent_levels WHERE level = ? LIMIT 1',
      [agent.level]
    );
    const level_name = levelRows[0]?.name || agent.level;

    const [parent, children, stats] = await Promise.all([
      Team.findParent(req.user.id),
      Team.findChildren(req.user.id),
      Team.stats(req.user.id),
    ]);
    const data = { is_agent: true, agent: { ...agent, level_name }, parent, children, stats };
    try {
      await redis.set(cacheKey, JSON.stringify(data), 'EX', 300);
    } catch (_) {}
    ok(res, data);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/team/tree（O3：递归加 LIMIT，O8：Redis 缓存 5min）
// query: page=1&pageSize=20&depth=1（depth 默认 1 = 直属下级，0 = 仅自己）
router.get('/tree', auth, async (req, res) => {
  try {
    const redis = getRedis();
    const cacheKey = REDIS_KEYS.TEAM_TREE(req.user.id);
    const { page = '1', pageSize = '20', depth = '1' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
    const depthNum = parseInt(depth, 10);
    const cacheKeyPaged = `${cacheKey}:p:${pageNum}:${pageSizeNum}:d:${depthNum}`;
    let cached = null;
    try {
      cached = await redis.get(cacheKeyPaged);
    } catch (_) {}
    if (cached) return ok(res, JSON.parse(cached));

    const agent = await Agent.findActive(req.user.id);
    if (!agent) return ok(res, { is_agent: false });

    const result = await Team.findTree(req.user.id, { page: pageNum, pageSize: pageSizeNum, depthFilter: depthNum });
    try {
      await redis.set(cacheKeyPaged, JSON.stringify(result), 'EX', 300);
    } catch (_) {}
    ok(res, result);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});
module.exports = router;
