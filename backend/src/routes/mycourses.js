const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/my/courses 我的课程（含 video_url，仅已购课程）
router.get('/courses', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT o.id as order_id, c.id as course_id, c.title, c.cover_image, c.price,
                o.status as order_status, o.created_at as buy_time,
                CASE WHEN c.is_free = 1 THEN c.video_url ELSE NULL END as video_url
         FROM orders o
         JOIN courses c ON c.id = o.course_id
         WHERE o.user_id = ? AND o.status IN (1, 2)
         ORDER BY o.id DESC LIMIT ? OFFSET ?`,
        [req.user.id, parseInt(page_size), offset]
      ),
      db.query(
        'SELECT COUNT(*) as cnt FROM orders WHERE user_id = ? AND status IN (1, 2)',
        [req.user.id]
      ),
    ]);
    ok(res, { rows: rows || [], total: total[0]?.cnt || 0 });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

module.exports = router;
