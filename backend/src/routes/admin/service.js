const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const auth = require('../../middleware/auth');
const { notifyUser, notifyAdmins } = require('../../websocket');
const adminAuth = require('../../middleware/admin'); // 管理员权限中间件

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/admin/service/conversations 全部会话列表（管理员）
// GET /api/admin/service/conversations?status=0&type=consultation
router.get('/conversations', auth, adminAuth, async (req, res) => {
  try {
    const { status, type } = req.query;
    let sql = `SELECT cs.*,
        u.nickname as user_nickname, u.phone as user_phone,
        (SELECT content FROM customer_messages WHERE conversation_id = cs.id ORDER BY id DESC LIMIT 1) as last_content,
        (SELECT COUNT(*) FROM customer_messages WHERE conversation_id = cs.id AND is_read = 0 AND is_from_admin = 0) as unread_user
       FROM customer_services cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE 1=1`;
    const params = [];
    if (status !== undefined) {
      sql += ' AND cs.status = ?';
      params.push(Number(status));
    }
    if (type) {
      sql += ' AND cs.type = ?';
      params.push(type);
    }
    sql += ' ORDER BY cs.last_message_at DESC LIMIT 100';
    const rows = await db.query(sql, params);
    ok(res, { rows, total: rows.length });
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/admin/service/conversations/:id 某个会话详情
router.get('/conversations/:id', auth, adminAuth, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT cs.*, u.nickname as user_nickname, u.phone as user_phone
       FROM customer_services cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE cs.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return fail(res, 404, 40400, '会话不存在');
    ok(res, rows[0]);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/admin/service/messages/:conversationId 消息历史
router.get('/messages/:conversationId', auth, adminAuth, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT m.*,
        CASE WHEN m.is_from_admin = 1 THEN a.nickname ELSE u.nickname END as sender_nickname,
        CASE WHEN m.is_from_admin = 1 THEN a.phone ELSE u.phone END as sender_phone
       FROM customer_messages m
       LEFT JOIN users u ON u.id = m.sender_id AND m.is_from_admin = 0
       LEFT JOIN users a ON a.id = m.admin_id AND m.is_from_admin = 1
       WHERE m.conversation_id = ?
       ORDER BY m.id ASC LIMIT 200`,
      [req.params.conversationId]
    );

    // 标记用户发的消息为已读（管理员打开时，UPDATE 返回 OkPacket）
    await db.query(
      `UPDATE customer_messages SET is_read = 1
       WHERE conversation_id = ? AND is_from_admin = 0 AND is_read = 0`,
      [req.params.conversationId]
    );

    ok(res, { rows, total: rows.length });
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/service/messages/:conversationId 管理员发送消息
router.post('/messages/:conversationId', auth, adminAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return fail(res, 400, 40000, '内容不能为空');

    const convRows = await db.query(
      `SELECT * FROM customer_services WHERE id = ? LIMIT 1`,
      [req.params.conversationId]
    );
    if (!convRows.length) return fail(res, 404, 40400, '会话不存在');

    const result = await db.query(
      `INSERT INTO customer_messages (conversation_id, sender_id, content, is_read, is_from_admin, admin_id, created_at)
       VALUES (?, ?, ?, 1, 1, ?, NOW())`,
      [req.params.conversationId, req.user.id, content, req.user.id]
    );
    // db.query INSERT returns OkPacket {insertId, affectedRows}
    const insertId = result.insertId !== undefined ? result.insertId : (result[0] && result[0].insertId) || 0;
    await db.query(
      `UPDATE customer_services
       SET last_message_id = ?, last_message_user_id = ?, last_message_at = NOW(), status = 1
       WHERE id = ?`,
      [insertId, req.user.id, req.params.conversationId]
    );

    // WebSocket 推送：回复给用户
    const conv = convRows[0];
    notifyUser(conv.user_id, 'admin_reply', {
      conversationId: parseInt(req.params.conversationId),
      messageId: insertId,
      content,
      fromAdminNickname: req.user.nickname || '客服',
      ts: Date.now(),
    });

    // WebSocket 推送：通知所有管理员会话列表有更新
    notifyAdmins('conversation_updated', {
      conversationId: parseInt(req.params.conversationId),
      ts: Date.now(),
    });

    ok(res, { id: insertId });
  } catch (err) {
    return fail(res, 500, 50000, '发送失败');
  }
});

// PUT /api/admin/service/conversations/:id/status 更新会话状态
router.put('/conversations/:id/status', auth, adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (status === undefined) return fail(res, 400, 40000, 'status不能为空');
    if (![0, 1, 2].includes(Number(status))) return fail(res, 400, 40000, 'status值非法');
    const result = await db.query(
      `UPDATE customer_services SET status = ?, updated_at = NOW() WHERE id = ?`,
      [Number(status), req.params.id]
    );
    // db.query returns OkPacket directly (not array) for UPDATE
    const affected = result.affectedRows !== undefined ? result.affectedRows : (result[0] ? result[0].affectedRows : 0);
    if (affected === 0) return fail(res, 404, 40400, '会话不存在');
    ok(res, null);
  } catch (err) {
    console.error('[updateStatus error]', err);
    return fail(res, 500, 50000, '更新失败');
  }
});

// GET /api/admin/service/stats 统计
router.get('/stats', auth, adminAuth, async (req, res) => {
  try {
    const totalRows = await db.query(`SELECT COUNT(*) as n FROM customer_services`);
    const pendingRows = await db.query(`SELECT COUNT(*) as n FROM customer_services WHERE status = 0`);
    const repliedRows = await db.query(`SELECT COUNT(*) as n FROM customer_services WHERE status = 1`);
    const closedRows = await db.query(`SELECT COUNT(*) as n FROM customer_services WHERE status = 2`);
    const unreadRows = await db.query(`SELECT COUNT(*) as n FROM customer_messages WHERE is_read = 0 AND is_from_admin = 0`);
    ok(res, {
      total: totalRows[0] ? totalRows[0].n : 0,
      pending: pendingRows[0] ? pendingRows[0].n : 0,
      replied: repliedRows[0] ? repliedRows[0].n : 0,
      closed: closedRows[0] ? closedRows[0].n : 0,
      unread_user_messages: unreadRows[0] ? unreadRows[0].n : 0,
    });
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

module.exports = router;
