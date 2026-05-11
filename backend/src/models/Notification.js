const db = require('../config/database');

/**
 * 发送站内通知（异步，不阻塞主流程）
 * @param {number} userId - 接收通知的用户ID
 * @param {string} type - 通知类型，如 'withdraw_approved' | 'withdraw_rejected' | 'agent_approved'
 * @param {string} title - 通知标题
 * @param {object} data - 附加数据，会序列化为 JSON 存入 content 字段
 */
function send(userId, type, title, data = {}) {
  // 不 await，直接 fire-and-forget
  db.query(
    'INSERT INTO notifications (user_id, type, title, content, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())',
    [userId, type, title, JSON.stringify(data)]
  ).catch(err => console.error('[Notification] send failed:', err.message));
}

module.exports = { send };
