const db = require('../config/database');
const bcrypt = require('bcryptjs');

const TABLE = 'users';

const User = {
  // 微信登录：查找或创建用户 + 创建 teams 记录
  async findOrCreateByOpenid(openid, nickname, promotionCode) {
    let users = await db.query(
      'SELECT * FROM users WHERE openid = ? LIMIT 1',
      [openid]
    );
    let user;
    if (users.length > 0) {
      user = users[0];
    } else {
      const result = await db.execute(
        'INSERT INTO users (openid, nickname, status) VALUES (?, ?, 1)',
        [openid, nickname || '微信用户']
      );
      const ins = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [result.insertId]);
      user = ins[0];
    }

    // 创建 teams 记录（若尚无）
    const existing = await db.query('SELECT id FROM teams WHERE user_id = ? LIMIT 1', [user.id]);
    if (!existing || existing.length === 0) {
      const cfg = await db.query("SELECT value FROM configs WHERE `key` = 'platform_root_user_id' LIMIT 1");
      const rootId = cfg.length ? parseInt(cfg[0].value) : 1;

      let parentId = null;
      let finalRootId = rootId;

      if (promotionCode) {
        const codeRows = await db.query(
          `SELECT a.user_id
           FROM promotion_codes pc
           JOIN agents a ON a.user_id = pc.user_id AND a.status = 1
           WHERE pc.code = ? LIMIT 1`,
          [promotionCode]
        );
        if (codeRows.length) {
          parentId = codeRows[0].user_id;
          finalRootId = await findRootIdRecursive(parentId);
        }
      }

      await db.execute(
        'INSERT INTO teams (user_id, parent_id, root_id, created_at) VALUES (?, ?, ?, NOW())',
        [user.id, parentId, finalRootId]
      );
    }

    return user;
  },

  async findById(id) {
    const rows = await db.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async findByOpenid(openid) {
    const rows = await db.query('SELECT * FROM users WHERE openid = ? LIMIT 1', [openid]);
    return rows[0] || null;
  },

  /**
   * 管理员凭证查询（精确查1条，不扫描全表）
   * username 支持手机号(phone)或用户ID精确匹配
   * bcrypt 校验改为异步，避免同步调用阻塞事件循环
   */
  async findAdminByCredentials(username, password) {
    if (!username || !password) return null;
    // 必须是 is_admin=1 才算管理员
    const rows = await db.query(
      `SELECT * FROM users WHERE is_admin = 1 AND (phone = ? OR id = ? OR openid = ? OR nickname = ?) AND admin_password IS NOT NULL AND admin_password != '' LIMIT 1`,
      [username, Number.isInteger(Number(username)) ? Number(username) : -1, username, username]
    );
    if (!rows.length) return null;
    const user = rows[0];
    const match = await new Promise((resolve) => {
      bcrypt.compare(password, user.admin_password, (err, result) => {
        if (err) { console.error('[findAdminByCredentials] bcrypt error:', err); resolve(false); }
        else resolve(result);
      });
    });
    return match ? user : null;
  },

  async updateAdminPassword(id, hashedPassword) {
    return db.execute('UPDATE users SET admin_password = ? WHERE id = ?', [hashedPassword, id]);
  },

  async update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    const setClause = keys.map(k => '`' + k + '` = ?').join(', ');
    const values = keys.map(function(k) { return fields[k]; });
    values.push(id);
    return db.execute('UPDATE users SET ' + setClause + ' WHERE id = ?', values);
  },

  async findAll(opts) {
    opts = opts || {};
    const page = opts.page || 1;
    const pageSize = opts.pageSize || 20;
    const offset = (page - 1) * pageSize;
    const cond = [];
    const params = [];

    // 排除管理员
    cond.push('u.is_admin = 0');

    // 按分销商状态筛选: agent_type=all|distributor|regular
    if (opts.agentType && opts.agentType !== 'all') {
      if (opts.agentType === 'distributor') {
        cond.push('ag.status = 1');
      } else if (opts.agentType === 'regular') {
        cond.push('(ag.status IS NULL OR ag.status != 1)');
      }
    }

    // 关键词: 手机号 或 微信昵称
    if (opts.keyword && opts.keyword.trim()) {
      const kw = '%' + opts.keyword.trim() + '%';
      cond.push('(u.phone LIKE ? OR u.nickname LIKE ?)');
      params.push(kw, kw);
    }

    const where = cond.length ? ' WHERE ' + cond.join(' AND ') : '';
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT u.id, u.nickname, u.avatar, u.phone, u.openid, u.status as user_status,
                u.created_at,
                ag.id as agent_id, ag.level as agent_level, ag.status as agent_status
         FROM users u
         LEFT JOIN agents ag ON ag.user_id = u.id AND ag.status = 1
         ${where}
         ORDER BY u.id DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      ),
      db.query(
        `SELECT COUNT(*) as cnt FROM users u LEFT JOIN agents ag ON ag.user_id = u.id AND ag.status = 1 ${where}`,
        params
      ),
    ]);
    return { rows: rows || [], total: total[0].cnt };
  },
};

// 模块级缓存：避免 findRootIdRecursive 每层递归重复查询 platform_root_user_id
let _platformRootIdCache = null;

function getPlatformRootId() {
  if (_platformRootIdCache !== null) return _platformRootIdCache;
  // 同步读取（仅在首次调用时执行一次），后续使用缓存值
  return null; // 异步填充，见 findRootIdRecursive
}

// 递归向上查找第一个有效分销商作为 root_id
async function findRootIdRecursive(userId) {
  if (_platformRootIdCache === null) {
    const cfg = await db.query("SELECT value FROM configs WHERE `key` = 'platform_root_user_id' LIMIT 1");
    _platformRootIdCache = cfg.length > 0 ? parseInt(cfg[0].value) : 1;
  }
  const platformRootId = _platformRootIdCache;

  let currentId = userId;
  const visited = new Set();

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    if (currentId === platformRootId) return platformRootId;

    const agentRows = await db.query('SELECT id FROM agents WHERE user_id = ? AND status = 1 LIMIT 1', [currentId]);
    if (agentRows.length > 0) return currentId;

    const teamRows = await db.query('SELECT parent_id FROM teams WHERE user_id = ? LIMIT 1', [currentId]);
    if (teamRows.length === 0 || teamRows[0].parent_id === null) break;
    currentId = teamRows[0].parent_id;
  }

  return platformRootId;
}

module.exports = User;
