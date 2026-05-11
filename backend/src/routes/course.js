const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const auth = require('../middleware/auth');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/course/list
router.get('/list', async (req, res) => {
  try {
    const { category_id, keyword, page = 1, page_size = 20 } = req.query;
    const safePage = Math.max(1, parseInt(page) || 1);
    const safePageSize = Math.max(1, parseInt(page_size) || 20);
    const result = await Course.list({
      categoryId: category_id,
      keyword,
      page: safePage,
      pageSize: safePageSize,
    });
    ok(res, result);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/course/detail/:id (可选认证：未登录也能查看课程信息)
router.get('/detail/:id', auth.optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return fail(res, 400, 40000, '无效的课程ID');
    const course = await Course.getDetail(id, req.user ? req.user.id : null);
    if (!course) return fail(res, 404, 40400, '课程不存在');
    ok(res, course);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/course/categories
router.get('/categories', async (req, res) => {
  try {
    const cats = await Course.categories();
    ok(res, cats);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// ===== 管理员课程管理 =====
// POST /api/course/create
router.post('/create', auth, async (req, res) => {
  try {
    if (!req.user.is_admin) return fail(res, 403, 40300, '需要管理员权限');
    const { price, original_price } = req.body;
    if (price !== undefined && (isNaN(price) || price < 0)) {
      return fail(res, 400, 40000, '课程价格不能为负数');
    }
    if (original_price !== undefined && (isNaN(original_price) || original_price < 0)) {
      return fail(res, 400, 40000, '原价不能为负数');
    }
    const id = await Course.create(req.body);
    ok(res, { id });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '创建失败');
  }
});

// PUT /api/course/:id
router.put('/:id', auth, async (req, res) => {
  try {
    if (!req.user.is_admin) return fail(res, 403, 40300, '需要管理员权限');
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return fail(res, 400, 40000, '无效的课程ID');
    const { price, original_price } = req.body;
    if (price !== undefined && (isNaN(price) || price < 0)) {
      return fail(res, 400, 40000, '课程价格不能为负数');
    }
    if (original_price !== undefined && (isNaN(original_price) || original_price < 0)) {
      return fail(res, 400, 40000, '原价不能为负数');
    }
    await Course.update(id, req.body);
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '更新失败');
  }
});

module.exports = router;
