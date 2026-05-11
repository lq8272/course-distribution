const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');
const PromotionCode = require('../models/PromotionCode');
const db = require('../config/database');
const SystemConfig = require('../models/SystemConfig');
const auth = require('../middleware/auth');
const Commission = require('../models/Commission');
const { getRedis, REDIS_KEYS } = require('../config/redis');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/agent/my 当前用户的分销状态
router.get('/my', auth, async (req, res) => {
  try {
    const agent = await Agent.findByUserId(req.user.id);
    if (!agent || agent.status !== 1) return ok(res, { is_agent: false });

    // 补充：推广码（幂等 upsert，已有直接返回，无则自动创建）
    const promoRecord = await PromotionCode.ensureForAgent(req.user.id, agent.level);
    const promotion_code = promoRecord.code || null;
    const promotion_url  = promoRecord.url  || null;

    // 补充：等级名称（从 agent_levels 查，db.query 返回 [row]）
    const levelRows = await db.query(
      'SELECT name FROM agent_levels WHERE level = ? LIMIT 1',
      [agent.level]
    );
    const level_name = levelRows[0]?.name || String(agent.level);

    const stats = await Commission.stats(req.user.id);
    // 推广链接：使用 PROMO_BASE_URL 环境变量拼接推广码
    const promo_base_url = process.env.PROMO_BASE_URL || '';
    ok(res, {
      is_agent: true,
      agent: {
        ...agent,
        promotion_code,
        promotion_url,
        promo_base_url,
        level_name,
      },
      stats,
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/agent/apply 申请成为分销商
router.post('/apply', auth, async (req, res) => {
  try {
    const { level, gift_quantity = 0, recommender_id } = req.body;
    if (!level) return fail(res, 400, 40000, '请选择分销等级');

    const existing = await Agent.findByUserId(req.user.id);
    if (existing && existing.status === 1) return fail(res, 400, 40000, '您已是分销商，请联系管理员');
    if (existing && existing.status === 0) return fail(res, 400, 40000, '您有待审核的分销申请，请等待审核');

    const id = await Agent.create({
      userId: req.user.id,
      level,
      giftQuantity: gift_quantity,
      recommenderId: recommender_id,
    });
    ok(res, { id });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '申请失败');
  }
});

// GET /api/agent/stats 佣金统计（Redis 缓存 1min）
router.get('/stats', auth, async (req, res) => {
  try {
    const redis = getRedis();
    const cacheKey = REDIS_KEYS.AGENT_STATS(req.user.id);
    const cached = await redis.get(cacheKey);
    if (cached) return ok(res, JSON.parse(cached));

    const stats = await Commission.stats(req.user.id);
    await redis.set(cacheKey, JSON.stringify(stats), 'EX', 60);
    ok(res, stats);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/agent/levels 获取分销等级列表（前端申请时选择用）
router.get('/levels', async (req, res) => {
  try {
    const rows = await db.query(
      'SELECT level, name, rebate_rate, gift_accounts, upgrade_referral_min, upgrade_gift_min FROM agent_levels ORDER BY sort ASC'
    );
    ok(res, rows);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/agent/team 我的团队（含各级人数）
router.get('/team', auth, async (req, res) => {
  try {
    const [directCount, allCount] = await Promise.all([
      db.query('SELECT COUNT(*) as cnt FROM teams WHERE parent_id = ?', [req.user.id]),
      db.query(
        `SELECT COUNT(*) as cnt FROM teams WHERE root_id = ? AND user_id != ?`,
        [req.user.id, req.user.id]
      ),
    ]);
    ok(res, {
      direct_count: directCount[0]?.cnt || 0,
      total_count: allCount[0]?.cnt || 0,
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/agent/withdraw 提现记录
router.get('/withdraw', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);

    let where = 'user_id = ?';
    const params = [req.user.id];

    // status=-1 表示全部，不加 where 条件；其他值精确匹配
    if (status !== undefined && status !== '' && String(status) !== '-1') {
      where += ' AND status = ?';
      params.push(parseInt(status));
    }

    const [rows, total] = await Promise.all([
      db.query(
        `SELECT id, amount, status, created_at FROM withdraw_records WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(page_size), offset]
      ),
      db.query(`SELECT COUNT(*) as cnt FROM withdraw_records WHERE ${where}`, params),
    ]);
    const statusMap = { 0: '审核中', 1: '已通过', 2: '已拒绝' };
    const records = (rows || []).map(r => ({ ...r, status_text: statusMap[r.status] || '未知' }));
    ok(res, { rows: records, total: total[0]?.cnt || 0 });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// ==================== 升级相关 ====================

// 等级优先级（用于判断下一等级）
const LEVEL_PRIORITY = { DR: 1, MXJ: 2, CJHH: 3 };

// GET /api/agent/upgrade/progress 升级进度
router.get('/upgrade/progress', auth, async (req, res) => {
  try {
    const agent = await Agent.findByUserId(req.user.id);
    if (!agent || agent.status !== 1) {
      return ok(res, { error: '您还不是分销商' });
    }

    const currentLevel = agent.level;
    const currentPriority = LEVEL_PRIORITY[currentLevel] || 0;

    // 没有更高等级
    if (currentPriority >= 3) {
      return ok(res, {
        current_level: currentLevel,
        next_level: null,
        required_count: 0,
        current_count: agent.referral_count || 0,
        is_top: true,
      });
    }

    // 查 agent_levels 找下一等级
    const nextLevelRows = await db.query(
      'SELECT level, name, upgrade_referral_min FROM agent_levels WHERE sort > (SELECT sort FROM agent_levels WHERE level = ?) ORDER BY sort ASC LIMIT 1',
      [currentLevel]
    );
    if (!nextLevelRows.length) {
      return ok(res, { current_level: currentLevel, next_level: null, is_top: true });
    }
    const nextLevel = nextLevelRows[0];

    // referral_count 来源于 agents.referral_count（approve 时更新）
    const currentCount = agent.referral_count || 0;
    const required = nextLevel.upgrade_referral_min || 0;

    // 累计拿货数量
    const totalPurchase = agent.total_purchase || 0;

    // 查询目标等级的最低拿货要求（从 configs 表查 min_purchase_qty_{toLevel}）
    const toLevelKey = nextLevel.level.toLowerCase();
    const [cfg] = await db.execute(
      "SELECT value FROM configs WHERE `key` = ?",
      [`min_purchase_qty_${toLevelKey}`]
    );
    const minPurchase = parseInt(cfg?.value || 0);

    ok(res, {
      current_level: currentLevel,
      next_level: nextLevel.level,
      next_level_name: nextLevel.name,
      required_count: required,
      current_count: currentCount,
      current_purchase: totalPurchase,
      min_purchase_for_upgrade: minPurchase,
      is_purchase_met: totalPurchase >= minPurchase && minPurchase > 0,
      is_condition_met: (currentCount >= required && required > 0) && (totalPurchase >= minPurchase || minPurchase === 0),
      is_top: false,
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/agent/upgrade/records 升级记录
router.get('/upgrade/records', auth, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT id, from_level, to_level, status, apply_fee, remark, created_at, confirm_time, reject_reason
       FROM agent_upgrades WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
      [req.user.id]
    );
    ok(res, rows);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/agent/upgrade/apply 申请升级
router.post('/upgrade/apply', auth, async (req, res) => {
  try {
    const agent = await Agent.findByUserId(req.user.id);
    if (!agent || agent.status !== 1) {
      return fail(res, 403, 40300, '您还不是分销商');
    }

    const currentLevel = agent.level;
    const currentPriority = LEVEL_PRIORITY[currentLevel] || 0;
    if (currentPriority >= 3) {
      return fail(res, 400, 40000, '已是最高等级，无需升级');
    }

    // 有待审核申请
    const pending = await db.query(
      'SELECT id FROM agent_upgrades WHERE user_id = ? AND status = 0 LIMIT 1',
      [req.user.id]
    );
    if (pending.length) {
      return fail(res, 400, 40000, '您有待审核的升级申请，请等待审核');
    }

    // 查下一等级
    const nextLevelRows = await db.query(
      'SELECT level, name, upgrade_referral_min, gift_accounts FROM agent_levels WHERE sort > (SELECT sort FROM agent_levels WHERE level = ?) ORDER BY sort ASC LIMIT 1',
      [currentLevel]
    );
    if (!nextLevelRows.length) {
      return fail(res, 400, 40000, '无可用升级等级');
    }
    const nextLevel = nextLevelRows[0];

    // 校验推荐人数是否满足
    const currentCount = agent.referral_count || 0;
    if (currentCount < nextLevel.upgrade_referral_min) {
      return fail(res, 400, 40000, `推荐人数不足，还需 ${nextLevel.upgrade_referral_min - currentCount} 人`);
    }

    // 计算申请费 = 目标等级申请费 - 当前等级申请费
    const feeKey = `apply_fee_${nextLevel.level.toLowerCase()}`;
    const currentFeeKey = `apply_fee_${currentLevel.toLowerCase()}`;
    const [feeRows] = await db.query("SELECT `key`, value FROM configs WHERE `key` IN (?, ?)", [feeKey, currentFeeKey]);
    const feeMap = {};
    feeRows.forEach(r => { feeMap[r.key] = parseFloat(r.value) || 0; });
    const applyFee = Math.max(0, (feeMap[feeKey] || 0) - (feeMap[currentFeeKey] || 0));

    await db.query(
      `INSERT INTO agent_upgrades (user_id, from_level, to_level, apply_fee, status, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [req.user.id, currentLevel, nextLevel.level, applyFee]
    );

    ok(res, { message: '升级申请已提交' });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '申请失败');
  }
});

module.exports = router;
