const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// POST /api/v1/feedbacks 提交意见反馈
router.post('/', auth, async (req, res) => {
  try {
    const { type, content } = req.body;
    if (!type || !content) return fail(res, 400, 40000, '类型和内容不能为空');
    if (!['bug', 'suggest', 'other'].includes(type)) return fail(res, 400, 40000, '类型非法');
    if (content.trim().length < 5) return fail(res, 400, 40000, '内容太短');
    if (content.trim().length > 2000) return fail(res, 400, 40000, '内容过长');

    const r = await db.query(
      `INSERT INTO feedbacks (user_id, type, content, status) VALUES (?, ?, ?, 0)`,
      [req.user.id, type, content.trim()]
    );
    const insertId = r.insertId !== undefined ? r.insertId : (r[0] && r[0].insertId) || 0;
    ok(res, { id: insertId });
  } catch (err) {
    console.error('[feedbacks] submit error:', err);
    return fail(res, 500, 50000, '提交失败');
  }
});

// GET /api/v1/feedbacks 我的反馈列表
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    let sql = 'SELECT id, type, content, status, reply, created_at FROM feedbacks WHERE user_id = ?';
    const params = [req.user.id];
    if (status !== undefined) {
      sql += ' AND status = ?';
      params.push(Number(status));
    }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), offset);
    const rows = await db.query(sql, params);

    const cntSql = `SELECT COUNT(*) as total FROM feedbacks WHERE user_id = ?${status !== undefined ? ' AND status = ' + Number(status) : ''}`;
    const [{ total }] = await db.query(cntSql, [req.user.id]);
    ok(res, { rows, total });
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/v1/feedbacks/:id 反馈详情
router.get('/:id', auth, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT f.*, u.nickname as handler_nickname
       FROM feedbacks f
       LEFT JOIN users u ON u.id = f.handler_id
       WHERE f.id = ? AND f.user_id = ? LIMIT 1`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return fail(res, 404, 40400, '反馈不存在');
    ok(res, rows[0]);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

module.exports = router;
