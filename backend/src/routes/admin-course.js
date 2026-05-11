/**
 * 管理员课程管理 API
 * POST /api/admin/course/create   — 创建课程（含视频）
 * PUT  /api/admin/course/:id       — 更新课程
 * GET  /api/admin/course/list      — 课程列表（管理员用，含全部课程）
 * DELETE /api/admin/course/:id     — 删除课程
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Course = require('../models/Course');
const db = require('../config/database');
const videoService = require('../services/video');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// 所有接口需管理员权限
router.use(auth, (req, res, next) => {
  if (!req.user.is_admin) return fail(res, 403, 40300, '需要管理员权限');
  next();
});

// GET /api/admin/course/list
router.get('/list', async (req, res) => {
  try {
    const { page = 1, page_size = 20, keyword } = req.query;
    const result = await Course.listAdmin({
      page: parseInt(page),
      pageSize: parseInt(page_size),
      keyword,
    });
    ok(res, result);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/course/create
router.post('/create', async (req, res) => {
  try {
    const { title, description, cover_image, video_key, price, is_free, category_id, sort, is_distribution, commission_ratio } = req.body;
    if (!title) return fail(res, 400, 40000, '课程标题不能为空');
    if (title.length > 200) return fail(res, 400, 40002, '课程标题不能超过200字符');
    if (price !== undefined && price !== null && (isNaN(Number(price)) || Number(price) < 0)) {
      return fail(res, 400, 40003, '课程价格不能为负数');
    }

    const id = await Course.create({
      title,
      description,
      cover_image,
      video_key,      // 存七牛 key，前端用 play-url 接口拿签名播放地址
      price: price || 0,
      is_free: is_free ? 1 : 0,
      category_id,
      sort: sort || 0,
      is_distribution: is_distribution ? 1 : 0,
      commission_ratio: commission_ratio || 0,
    });
    ok(res, { id });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '创建失败');
  }
});

// PUT /api/admin/course/:id
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existed = await Course.findById(id);
    if (!existed) return fail(res, 404, 40400, '课程不存在');

    // 边界校验
    if (req.body.title !== undefined && req.body.title.length > 200) {
      return fail(res, 400, 40002, '课程标题不能超过200字符');
    }
    if (req.body.price !== undefined && req.body.price !== null && (isNaN(Number(req.body.price)) || Number(req.body.price) < 0)) {
      return fail(res, 400, 40003, '课程价格不能为负数');
    }

    // video_key 通过 video/upload-token 获得，这里直接更新
    await Course.update(id, req.body);
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '更新失败');
  }
});

// DELETE /api/admin/course/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const course = await Course.findById(id);
    if (!course) return fail(res, 404, 40400, '课程不存在');

    // 删除七牛视频文件
    if (course.video_key) {
      try {
        await videoService.deleteFile(course.video_key);
      } catch (e) {
        console.warn('删除七牛视频失败:', e.message);
      }
    }

    // 先删关联的佣金记录、订单记录，再删课程
    const conn = await db.getConnection();
    try {
      await conn.execute('DELETE FROM commissions WHERE order_id IN (SELECT id FROM orders WHERE course_id = ?)', [id]);
      await conn.execute('DELETE FROM orders WHERE course_id = ?', [id]);
      await conn.execute('DELETE FROM courses WHERE id = ?', [id]);
    } finally {
      conn.release();
    }
    ok(res, null);
  } catch (err) {
    console.error('[admin-course DELETE]', err);
    return fail(res, 500, 50000, '删除失败');
  }
});

module.exports = router;
