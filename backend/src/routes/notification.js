const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/notifications 通知列表
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT id, title, content, is_read, created_at
         FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
        [req.user.id, parseInt(page_size), offset]
      ),
      db.query('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ?', [req.user.id]),
    ]);
    ok(res, { rows: rows || [], total: total[0]?.cnt || 0 });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// PUT /api/notifications/:id/read 标记单条已读
router.put('/:id/read', auth, async (req, res) => {
  try {
    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [parseInt(req.params.id), req.user.id]
    );
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '标记失败');
  }
});

// PUT /api/notifications/read-all 全部标记已读
router.put('/read-all', auth, async (req, res) => {
  try {
    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '操作失败');
  }
});

// GET /api/notifications/unread-count 未读数量
router.get('/unread-count', auth, async (req, res) => {
  try {
    const rows = await db.query(
      'SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    ok(res, { count: rows[0]?.cnt || 0 });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

module.exports = router;
