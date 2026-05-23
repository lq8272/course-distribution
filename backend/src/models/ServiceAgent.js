const db = require('../config/database');
const bcrypt = require('bcryptjs');

const ServiceAgent = {
  /** 根据用户名查找客服 */
  async findByUsername(username) {
    const rows = await db.query(
      'SELECT * FROM service_agents WHERE username = ? AND status = 1 LIMIT 1',
      [username]
    );
    return rows[0] || null;
  },

  /** 验证密码 */
  async verifyPassword(plain, hashed) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(plain, hashed, (err, ok) => {
        if (err) reject(err); else resolve(ok);
      });
    });
  },

  /** 根据ID查找 */
  async findById(id) {
    const rows = await db.query(
      'SELECT id, username, nickname, avatar, status, max_handling, online FROM service_agents WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  /** 创建客服账号 */
  async create({ username, password, nickname }) {
    const hashed = await new Promise((resolve, reject) => {
      bcrypt.hash(password, 10, (err, result) => {
        if (err) reject(err); else resolve(result);
      });
    });
    const r = await db.query(
      'INSERT INTO service_agents (username, password, nickname, status) VALUES (?, ?, ?, 1)',
      [username, hashed, nickname]
    );
    return r.insertId;
  },

  /** 更新在线状态 */
  async setOnline(id, online) {
    await db.query('UPDATE service_agents SET online = ? WHERE id = ?', [online ? 1 : 0, id]);
  },

  /** 获取在线客服列表 */
  async listOnline() {
    return db.query(
      'SELECT id, nickname, avatar, max_handling FROM service_agents WHERE status = 1 AND online = 1'
    );
  },

  /** 统计客服当前处理会话数 */
  async handlingCount(agentId) {
    const [{ cnt }] = await db.query(
      'SELECT COUNT(*) as cnt FROM service_assignments sa JOIN customer_services cs ON cs.id = sa.conversation_id WHERE sa.agent_id = ? AND cs.status = 0',
      [agentId]
    );
    return cnt;
  },
};

module.exports = ServiceAgent;
