const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');
const { notifyUser, notifyAdmins } = require('../websocket');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// ─── Prompt 注入过滤 ───
/**
 * 移除用户消息中的 Prompt 注入模式，防止用户通过消息注入指令
 * 过滤模式：system prompt 注入、XML 标签注入、特殊指令前缀
 */
function sanitizeUserMessage(msg) {
  if (!msg) return '';
  return msg
    .replace(/<(\/?)(system|prompt|instruction|的角色|你是一个|你现在是)/gi, '')
    .replace(/^[\s]*(system|prompt|instruction|ai[,\s:：])/gim, '')
    .replace(/\x00/g, '')
    .slice(0, 500);
}

// ─── AI 自动回复（Groq + Llama）───
const AI_ENABLED = process.env.AI_ENABLED === 'true';
const AI_PROVIDER = process.env.AI_PROVIDER || 'groq'; // 'groq' | 'deepseek' | 'fake'
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
const AI_DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const AI_GROQ_KEY = process.env.GROQ_API_KEY || '';

/** 调用 AI 生成回复（支持 Groq / DeepSeek ChatML / Fake 三种模式） */
async function generateAIReply(userMessage, conversationContext = []) {
  if (!AI_ENABLED) return null;

  // 入口处统一过滤，防止 prompt 注入
  userMessage = sanitizeUserMessage(userMessage);
  if (!userMessage) return null;

  const systemPrompt = `你是一个专业的视频课程分销平台客服助手，名字叫"小雪"。
你的职责是：
- 回答用户关于课程内容、购买问题、分销政策、佣金提现等常见问题
- 语气友好、专业、耐心
- 如果问题超出范围，请回复"这个问题我已经记录，稍后转人工客服处理"
- 回答控制在 100 字以内，简明扼要`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationContext.slice(-6), // 最近 3 轮对话
    { role: 'user', content: userMessage },
  ];

  // ── Fake 模式：关键词兜底回复（纯本地，无需 API）───
  if (AI_PROVIDER === 'fake') {
    const lower = userMessage.toLowerCase();
    if (lower.includes('佣金') || lower.includes('提现')) {
      return '您好！佣金满100元即可申请提现，审核通过后1-3个工作日到账。提现手续费为1%。如有疑问请继续咨询～';
    }
    if (lower.includes('课程') || lower.includes('视频')) {
      return '您好！平台所有课程均为高清视频，购买后永久可看。支持微信支付，课程不支持退款哦。请问还有什么需要了解的吗？';
    }
    if (lower.includes('分销') || lower.includes('推广')) {
      return '您好！成为分销商后分享课程给好友，好友购买即可获得佣金奖励。佣金比例最高30%！请问您想了解分销政策的哪方面呢？';
    }
    return '您好！感谢您的咨询，我是客服小雪。请问有什么可以帮助您的？';
  }

  // ── Groq（Llama，速度快）───
  if (AI_PROVIDER === 'groq' && AI_GROQ_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: AI_MODEL, messages, max_tokens: 200, temperature: 0.7 }),
      });
      if (!res.ok) throw new Error(`Groq ${res.status}`);
      const json = await res.json();
      return json.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
      console.error('[AI] Groq error:', e.message);
      return null;
    }
  }

  // ── DeepSeek（ChatML 格式）───
  if (AI_PROVIDER === 'deepseek' && AI_DEEPSEEK_KEY) {
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AI_DEEPSEEK_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'deepseek-chat', messages, max_tokens: 200, temperature: 0.7 }),
      });
      if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
      const json = await res.json();
      return json.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
      console.error('[AI] DeepSeek error:', e.message);
      return null;
    }
  }

  return null;
}

// GET /api/service/conversations 我的会话列表
router.get('/conversations', auth, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT cs.*,
        u.nickname as last_message_user,
        (SELECT content FROM customer_messages WHERE conversation_id = cs.id ORDER BY id DESC LIMIT 1) as last_content,
        (SELECT COUNT(*) FROM customer_messages WHERE conversation_id = cs.id AND is_read = 0 AND is_from_admin = 1) as unread_count
       FROM customer_services cs
       LEFT JOIN users u ON u.id = cs.last_message_user_id
       WHERE cs.user_id = ? ORDER BY cs.last_message_at DESC LIMIT 50`,
      [req.user.id]
    );
    ok(res, rows);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/service/conversations 创建/继续会话
router.post('/conversations', auth, async (req, res) => {
  try {
    const { type, subject } = req.body;
    if (!type) return fail(res, 400, 40000, 'type不能为空');

    // 幂等控制：若存在同用户同type且进行中的会话，直接返回该会话
    const existing = await db.query(
      `SELECT id FROM customer_services WHERE user_id = ? AND type = ? AND status = 0 LIMIT 1`,
      [req.user.id, type]
    );
    if (existing.length > 0) {
      return ok(res, { id: existing[0].id });
    }

    // db.query INSERT/UPDATE 返回 OkPacket 对象 {affectedRows, insertId, ...}
    let r;
    try {
      r = await db.query(
        `INSERT INTO customer_services (user_id, type, subject, status, last_message_at)
         VALUES (?, ?, ?, 0, NOW())`,
        [req.user.id, type, subject || '']
      );
    } catch (err) {
      console.error('[service] createConversation DB ERROR:', err.message);
      return fail(res, 500, 50000, '创建失败');
    }
    const insertId = r.insertId !== undefined ? r.insertId : (r[0] && r[0].insertId) || 0;
    ok(res, { id: insertId });
  } catch (err) {
    console.error('[service] createConversation ERROR:', err.message);
    return fail(res, 500, 50000, '创建失败');
  }
});

// GET /api/service/messages/:conversationId
router.get('/messages/:conversationId', auth, async (req, res) => {
  try {
    const convRows = await db.query(
      `SELECT * FROM customer_services WHERE id = ? AND user_id = ? LIMIT 1`,
      [req.params.conversationId, req.user.id]
    );
    if (!convRows.length) return fail(res, 404, 40400, '会话不存在');

    const rows = await db.query(
      `SELECT m.*, u.nickname as sender_nickname
       FROM customer_messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.id ASC LIMIT 200`,
      [req.params.conversationId]
    );

    // 标记用户收到的管理员消息为已读（UPDATE 返回 OkPacket）
    await db.query(
      `UPDATE customer_messages SET is_read = 1
       WHERE conversation_id = ? AND is_from_admin = 1 AND is_read = 0`,
      [req.params.conversationId]
    );

    ok(res, rows);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/service/messages/:conversationId 发送消息
router.post('/messages/:conversationId', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return fail(res, 400, 40000, '内容不能为空');

    // 验证会话归属
    const convRows = await db.query(
      `SELECT * FROM customer_services WHERE id = ? AND user_id = ? LIMIT 1`,
      [req.params.conversationId, req.user.id]
    );
    if (!convRows.length) return fail(res, 404, 40400, '会话不存在');

    // 插入消息
    const r = await db.query(
      `INSERT INTO customer_messages (conversation_id, sender_id, content, is_read, is_from_admin, created_at)
       VALUES (?, ?, ?, 0, 0, NOW())`,
      [req.params.conversationId, req.user.id, content]
    );
    const msgId = r.insertId !== undefined ? r.insertId : (r[0] && r[0].insertId) || 0;
    await db.query(
      `UPDATE customer_services
       SET last_message_id = ?, last_message_user_id = ?, last_message_at = NOW(), status = 0
       WHERE id = ?`,
      [msgId, req.user.id, req.params.conversationId]
    );

    // WebSocket 推送：通知所有管理员有新用户消息
    notifyAdmins('customer_message', {
      conversationId: parseInt(req.params.conversationId),
      senderId: req.user.id,
      senderNickname: req.user.nickname || '用户',
      content: content.slice(0, 100),
      ts: Date.now(),
    });

    // ── AI 自动回复（异步，不阻塞响应）───
    if (AI_ENABLED) {
      (async () => {
        try {
          // 拉取最近 3 轮对话上下文（双向）
          const history = await db.query(
            `SELECT content, is_from_admin FROM customer_messages
             WHERE conversation_id = ? ORDER BY id DESC LIMIT 6`,
            [req.params.conversationId]
          );
          // 构建 OpenAI 格式上下文（user/assistant 交替）
          const ctx = [...history].reverse().map(m => ({
            role: m.is_from_admin ? 'assistant' : 'user',
            content: m.content,
          }));
          const reply = await generateAIReply(content, ctx);
          if (reply) {
            // db.query INSERT 返回 OkPacket {affectedRows, insertId}
            const ar = await db.query(
              `INSERT INTO customer_messages (conversation_id, sender_id, content, is_read, is_from_admin, admin_id, created_at)
               VALUES (?, 0, ?, 0, 1, 0, NOW())`,
              [req.params.conversationId, reply]
            );
            const aiMsgId = ar.insertId !== undefined ? ar.insertId : (ar[0] && ar[0].insertId) || 0;
            await db.query(
              `UPDATE customer_services
               SET last_message_id = ?, last_message_user_id = 0, last_message_at = NOW(), status = 1
               WHERE id = ?`,
              [aiMsgId, req.params.conversationId]
            );

            // WebSocket 推送：AI 回复给用户
            const conv = convRows[0];
            notifyUser(conv.user_id, 'admin_reply', {
              conversationId: parseInt(req.params.conversationId),
              messageId: aiMsgId,
              content: reply,
              ts: Date.now(),
            });
            console.log(`[AI] auto-reply to conversation ${req.params.conversationId}: ${reply.slice(0, 50)}`);
          }
        } catch (e) {
          console.error('[AI] auto-reply error:', e.message);
        }
      })();
    }

    ok(res, { id: r.insertId });
  } catch (err) {
    return fail(res, 500, 50000, '发送失败');
  }
});

module.exports = router;
