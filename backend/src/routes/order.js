const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Course = require('../models/Course');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { getRedis, REDIS_KEYS } = require('../config/redis');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// POST /api/order/create
router.post('/create', auth, async (req, res) => {
  try {
    const { course_id, promotion_code } = req.body;
    if (!course_id) return fail(res, 400, 40000, 'course_id不能为空');
    const courseIdInt = parseInt(course_id);
    if (isNaN(courseIdInt) || courseIdInt <= 0) return fail(res, 400, 40000, 'course_id必须是正整数');

    const course = await Course.findById(courseIdInt);
    if (!course) return fail(res, 404, 40400, '课程不存在');

    // 查询推广码对应的分销商 user_id，并记录一次访问
    let directAgentId = null;
    let agentDbId = null; // agents.id
    if (promotion_code) {
      const codeRows = await db.query(
        'SELECT user_id FROM promotion_codes WHERE code = ? LIMIT 1',
        [promotion_code]
      );
      console.log(`[OrderCreate] promotion_code=${promotion_code}, codeRows=`, JSON.stringify(codeRows));
      if (codeRows.length) {
        directAgentId = codeRows[0].user_id;
        console.log(`[OrderCreate] directAgentId=${directAgentId}`);
        const agentRows = await db.query(
          'SELECT id FROM agents WHERE user_id = ? AND status = 1 LIMIT 1',
          [directAgentId]
        );
        console.log(`[OrderCreate] agents lookup=`, JSON.stringify(agentRows));
        if (agentRows.length) agentDbId = agentRows[0].id;
        // 更新推广码访问计数（FOR UPDATE 锁防止并发丢失更新）
        await db.query(
          'UPDATE promotion_codes SET visit_count = visit_count + 1 WHERE code = ? FOR UPDATE',
          [promotion_code]
        );
      }
    }

    const orderId = await Order.create({
      userId: req.user.id,
      courseId: course_id,
      agentId: agentDbId,
      promotionCodeId: null,
      directAgentId,
    });
    ok(res, { order_id: orderId });
  } catch (err) {
    console.error(err);
    if (err.message === '您已购买过该课程，请勿重复下单') {
      return fail(res, 400, 40001, err.message);
    }
    return fail(res, 500, 50000, '创建订单失败');
  }
});

// GET /api/order/my
router.get('/my', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const result = await Order.listByUser(req.user.id, {
      page: parseInt(page),
      pageSize: parseInt(page_size),
    });
    return ok(res, result);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/order/list
router.get('/list', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, status } = req.query;
    const result = await Order.listByUser(req.user.id, {
      page: parseInt(page),
      pageSize: parseInt(page_size),
      status: status !== undefined && status !== '' ? status : null,
    });
    ok(res, result);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/order/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(parseInt(req.params.id));
    if (!order) return fail(res, 404, 40400, '订单不存在');
    if (order.user_id !== req.user.id && !req.user.is_admin) return fail(res, 403, 40300, '无权限');
    ok(res, order);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/order/:id/confirm 管理员确认订单（虚拟支付完成）
router.post('/:id/confirm', auth, async (req, res) => {
  try {
    if (!req.user.is_admin) return fail(res, 403, 40300, '需要管理员权限');
    const order = await Order.confirm(parseInt(req.params.id));
    if (!order) return fail(res, 400, 40000, '订单不存在或状态不可确认');

    // 佣金已在 Order.confirm() 内部事务中结算完毕（T+0），此处不再重复调用
    // 仅清除团队树缓存
    const redis = getRedis();
    const keys = await redis.keys(`team:tree:*`);
    if (keys.length) await redis.del(...keys);

    ok(res, { status: 1 });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '确认失败');
  }
});

// POST /api/order/:id/refund 管理员退款（status=1→3，撤销佣金）
router.post('/:id/refund', auth, async (req, res) => {
  try {
    if (!req.user.is_admin) return fail(res, 403, 40300, '需要管理员权限');
    const order = await Order.refund(parseInt(req.params.id));
    if (!order) return fail(res, 400, 40000, '订单不存在或状态不可退款');
    ok(res, { status: 3 });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '退款失败');
  }
});

module.exports = router;
