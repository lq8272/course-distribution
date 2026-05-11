const db = require('../config/database');

/** 生成随机推广码（数字+字母） */
function generateCode(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 确保指定用户的指定等级拥有推广码（幂等 upsert）。
 * 已存在时直接返回已有记录，不重复生成。
 *
 * @param {number|string} userId
 * @param {string} level  分销等级 key，如 'DISTRIBUTORDR'
 * @returns {Promise<{code: string, url: string}>}
 */
async function ensureForAgent(userId, level) {
  const promoBaseUrl = (process.env.PROMO_BASE_URL || 'https://course.example.com')
    .trim().replace(/\/$/, '');

  // 已有则跳过（db.query LIMIT 1 返回 [row]，直接取 rows[0] 得行对象）
  const rows = await db.query(
    'SELECT code, url FROM promotion_codes WHERE user_id = ? AND level = ? LIMIT 1',
    [userId, level]
  );
  if (rows.length) {
    return rows[0];
  }

  // 唯一索引防重，INSERT IGNORE 保证幂等
  const code = generateCode(12);
  const url = `${promoBaseUrl}/register?code=${code}`;
  await db.execute(
    `INSERT IGNORE INTO promotion_codes (user_id, level, code, url, created_at)
     VALUES (?, ?, ?, ?, NOW())`,
    [userId, level, code, url]
  );

  // 再次查询（高并发时 INSERT IGNORE 可能被另一个请求抢先）
  const rows2 = await db.query(
    'SELECT code, url FROM promotion_codes WHERE user_id = ? AND level = ? LIMIT 1',
    [userId, level]
  );
  return rows2.length ? rows2[0] : { code, url };
}

module.exports = { generateCode, ensureForAgent };
