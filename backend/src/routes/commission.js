const express = require('express');
const router = express.Router();
const Commission = require('../models/Commission');
const Agent = require('../models/Agent');
const db = require('../config/database');
const { getRedis, REDIS_KEYS } = require('../config/redis');
const auth = require('../middleware/auth');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/commission/list
router.get('/list', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, type, status } = req.query;
    const result = await Commission.listByUser(req.user.id, {
      page: parseInt(page),
      pageSize: parseInt(page_size),
      type,
      status: status !== undefined ? parseInt(status) : undefined,
    });
    ok(res, result);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/commission/stats（Redis 缓存 1min）
router.get('/stats', auth, async (req, res) => {
  try {
    const redis = getRedis();
    const cacheKey = REDIS_KEYS.COMMISSION_STATS(req.user.id);
    let cached = null;
    try {
      cached = await redis.get(cacheKey);
    } catch (_) {}
    if (cached) return ok(res, JSON.parse(cached));

    const stats = await Commission.stats(req.user.id);
    try {
      await redis.set(cacheKey, JSON.stringify(stats), 'EX', 60);
    } catch (_) {}
    ok(res, stats);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/commission/withdraw
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return fail(res, 400, 40000, '请输入有效金额');

    // 事务内：锁定可用佣金 → 校验余额 → 扣除 → 写入提现记录
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      // 锁定用户的可用佣金记录（status=1），按创建时间顺序扣除（先到先得）
      const [availableRows] = await conn.query(
        `SELECT id, amount FROM commissions WHERE user_id = ? AND status = 1 ORDER BY id ASC FOR UPDATE`,
        [req.user.id]
      );
      let totalAvailable = 0;
      availableRows.forEach(r => { totalAvailable += parseFloat(r.amount); });
      if (totalAvailable < amount) {
        await conn.rollback(); conn.release();
        return fail(res, 400, 40000, '可用余额不足');
      }

      // 从佣金记录中扣除（分批扣减直到扣完）
      let remaining = amount;
      for (const row of availableRows) {
        if (remaining <= 0) break;
        const recordAmount = parseFloat(row.amount);
        if (recordAmount <= remaining) {
          await conn.execute(
            'UPDATE commissions SET status = 2 WHERE id = ? AND status = 1',
            [row.id]
          );
          remaining = Math.round((remaining - recordAmount) * 100) / 100;
        } else {
          // 最后一条：部分扣除，剩余回滚
          const part = Math.round(remaining * 100) / 100;
          const newAmount = Math.round((recordAmount - remaining) * 100) / 100;
          await conn.execute(
            'UPDATE commissions SET amount = ? WHERE id = ? AND status = 1',
            [newAmount, row.id]
          );
          remaining = 0;
        }
      }

      // 写入提现申请记录
      const [r] = await conn.execute(
        `INSERT INTO withdraw_records (user_id, amount, status, created_at) VALUES (?, ?, 0, NOW())`,
        [req.user.id, amount]
      );

      await conn.commit();
      conn.release();
      // 清理佣金统计缓存
      getRedis().del(REDIS_KEYS.COMMISSION_STATS(req.user.id));
      ok(res, { id: r.insertId });
    } catch (e) {
      await conn.rollback(); conn.release();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '申请失败');
  }
});
module.exports = router;
