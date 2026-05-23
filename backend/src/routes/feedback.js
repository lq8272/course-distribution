const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const { notifyAdmins } = require('../websocket');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// POST /api/v1/feedbacks 提交意见反馈
router.post('/', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const { type, content } = req.body;
    if (!type || !content) return fail(res, 400, 40000, '类型和内容不能为空');
    if (!['bug', 'suggest', 'other'].includes(type)) return fail(res, 400, 40000, '类型非法');
    if (content.trim().length < 5) return fail(res, 400, 40000, '内容太短');
    if (content.trim().length > 2000) return fail(res, 400, 40000, '内容过长');

    await conn.beginTransaction();

    // 1. 插入反馈记录
    const [r] = await conn.query(
      `INSERT INTO feedbacks (user_id, type, content, status, conversation_id)
       VALUES (?, ?, ?, 0, ?)`,
      [req.user.id, type, content.trim(), convId]
    );
    const feedbackId = r.insertId;

    // 2. 自动创建客服会话
    const [cr] = await conn.query(
      `INSERT INTO customer_services (user_id, type, subject, status, last_message_at)
       VALUES (?, 'feedback', ?, 0, NOW())`,
      [req.user.id, `[${typeMap[type]}] ${content.trim().slice(0, 80)}`]
    );
    const convId = cr.insertId;

    // 3. 写入会话首条消息（来自用户）
    await conn.query(
      `INSERT INTO customer_messages (conversation_id, sender_id, content, is_read, is_from_admin, created_at)
       VALUES (?, ?, ?, 0, 0, NOW())`,
      [convId, req.user.id, content.trim()]
    );

    // 4. 更新会话 last_message
    await conn.query(
      `UPDATE customer_services SET last_message_id = LAST_INSERT_ID(), last_message_user_id = ?
       WHERE id = ?`,
      [req.user.id, convId]
    );

    await conn.commit();

    // 5. WebSocket 通知所有管理员有新反馈会话
    notifyAdmins('customer_message', {
      conversation_id: convId,
      sender_id: req.user.id,
      sender_nickname: req.user.nickname || '用户',
      content: content.trim().slice(0, 100),
      type: 'feedback',
      ts: Date.now(),
    });

    ok(res, { id: feedbackId, conversation_id: convId });
  } catch (err) {
    await conn.rollback();
    console.error('[feedbacks] submit error:', err);
    return fail(res, 500, 50000, '提交失败');
  } finally {
    conn.release();
  }
});

const typeMap = { bug: '功能异常', suggest: '体验建议', other: '其他' };

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
