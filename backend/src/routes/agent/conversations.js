const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const agentAuth = require('../../middleware/agentAuth');
const { notifyUser } = require('../../websocket');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// 挂载中间件
router.use(agentAuth);

// ========== 客服工作台 ==========

// GET /api/agent/conversations 客服的会话列表
router.get('/conversations', async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT cs.*,
        u.nickname as user_nickname, u.phone as user_phone,
        (SELECT content FROM customer_messages WHERE conversation_id = cs.id ORDER BY id DESC LIMIT 1) as last_content,
        (SELECT COUNT(*) FROM customer_messages WHERE conversation_id = cs.id AND is_read = 0 AND is_from_admin = 0) as unread_count
       FROM service_assignments sa
       JOIN customer_services cs ON cs.id = sa.conversation_id
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE sa.agent_id = ?`;
    const params = [req.agent.id];
    if (status !== undefined) {
      sql += ' AND cs.status = ?';
      params.push(Number(status));
    }
    sql += ' ORDER BY cs.last_message_at DESC';

    const rows = await db.query(sql, params);
    const masked = rows.map(r => ({ ...r, user_phone: maskPhone(r.user_phone) }));
    ok(res, { rows: masked });
  } catch (err) {
    console.error('[agent/conversations]', err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/agent/conversations/:id/messages 会话消息列表
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const { page = 1, page_size = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const convId = parseInt(req.params.id);

    // 验证归属
    const [assign] = await db.query(
      'SELECT id FROM service_assignments WHERE conversation_id = ? AND agent_id = ? LIMIT 1',
      [convId, req.agent.id]
    );
    if (!assign) return fail(res, 403, 40300, '无权查看此会话');

    // 标记已读
    await db.query(
      'UPDATE customer_messages SET is_read = 1 WHERE conversation_id = ? AND is_from_admin = 0 AND is_read = 0',
      [convId]
    );

    const rows = await db.query(
      `SELECT cm.*, sa.nickname as agent_nickname
       FROM customer_messages cm
       LEFT JOIN service_agents sa ON sa.id = cm.admin_id
       WHERE cm.conversation_id = ?
       ORDER BY cm.id DESC LIMIT ? OFFSET ?`,
      [convId, parseInt(page_size), offset]
    );

    ok(res, { rows: rows.reverse() });
  } catch (err) {
    console.error('[agent/messages]', err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/agent/conversations/:id/reply 客服回复
router.post('/conversations/:id/reply', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return fail(res, 400, 40000, '内容不能为空');
    const convId = parseInt(req.params.id);

    // 验证归属
    const [assign] = await db.query(
      'SELECT id FROM service_assignments WHERE conversation_id = ? AND agent_id = ? LIMIT 1',
      [convId, req.agent.id]
    );
    if (!assign) return fail(res, 403, 40300, '无权操作此会话');

    // 插入消息
    const r = await db.query(
      `INSERT INTO customer_messages (conversation_id, sender_id, content, is_read, is_from_admin, admin_id, created_at)
       VALUES (?, 0, ?, 1, 1, ?, NOW())`,
      [convId, content, req.agent.id]
    );
    const msgId = r.insertId;

    // 更新会话
    await db.query(
      `UPDATE customer_services
       SET last_message_id = ?, last_message_user_id = 0, last_message_at = NOW(), status = 1
       WHERE id = ?`,
      [msgId, convId]
    );

    // WebSocket 推送
    const [conv] = await db.query('SELECT user_id FROM customer_services WHERE id = ? LIMIT 1', [convId]);
    if (conv) {
      notifyUser(conv.user_id, 'admin_reply', {
        conversation_id: convId,
        id: msgId,
        content,
        from_admin_nickname: req.agent.nickname,
        sender_id: req.agent.id,
        created_at: Date.now(),
      });
    }

    ok(res, { id: msgId });
  } catch (err) {
    console.error('[agent/reply]', err);
    return fail(res, 500, 50000, '发送失败');
  }
});

// PUT /api/agent/conversations/:id/close 关闭会话
router.put('/conversations/:id/close', async (req, res) => {
  try {
    const convId = parseInt(req.params.id);
    const [assign] = await db.query(
      'SELECT id FROM service_assignments WHERE conversation_id = ? AND agent_id = ? LIMIT 1',
      [convId, req.agent.id]
    );
    if (!assign) return fail(res, 403, 40300, '无权操作此会话');

    await db.query(
      'UPDATE customer_services SET status = 2, updated_at = NOW() WHERE id = ?',
      [convId]
    );
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '操作失败');
  }
});

// ========== 待分配会话（可抢接） ==========

// GET /api/agent/queue 待分配会话队列
router.get('/queue', async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT cs.*, u.nickname as user_nickname, u.phone as user_phone,
        (SELECT content FROM customer_messages WHERE conversation_id = cs.id ORDER BY id DESC LIMIT 1) as last_content,
        f.id as feedback_id, f.type as feedback_type
       FROM customer_services cs
       LEFT JOIN users u ON u.id = cs.user_id
       LEFT JOIN feedbacks f ON f.conversation_id = cs.id
       WHERE cs.status = 0
         AND cs.id NOT IN (SELECT conversation_id FROM service_assignments)
       ORDER BY cs.last_message_at ASC
       LIMIT 50`
    );
    const masked = rows.map(r => ({ ...r, user_phone: maskPhone(r.user_phone) }));
    ok(res, { rows: masked });
  } catch (err) {
    console.error('[agent/queue]', err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/agent/queue/:id/claim 客服抢接会话
router.post('/queue/:id/claim', async (req, res) => {
  try {
    const convId = parseInt(req.params.id);

    // 查当前处理数
    const count = await ServiceAgent.handlingCount(req.agent.id);
    if (count >= req.agent.max_handling) {
      return fail(res, 400, 40001, `已达接单上限（${req.agent.max_handling}个）`);
    }

    // 插入分配记录
    await db.query(
      'INSERT INTO service_assignments (conversation_id, agent_id, assigned_by) VALUES (?, ?, 0)',
      [convId, req.agent.id]
    );

    // 更新会话状态为进行中
    await db.query('UPDATE customer_services SET status = 0, updated_at = NOW() WHERE id = ?', [convId]);

    ok(res, null);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return fail(res, 409, 40900, '已被其他客服接单');
    }
    console.error('[agent/claim]', err);
    return fail(res, 500, 50000, '接单失败');
  }
});

// ========== 工具 ==========

function maskPhone(phone) {
  if (!phone) return null;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

module.exports = router;
