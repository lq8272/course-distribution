const db = require('../config/database');

const SystemConfig = {
  /** 获取所有配置项 */
  async getAll() {
    const rows = await db.query('SELECT `key`, value, description FROM configs ORDER BY id');
    return rows;
  },

  /** 批量更新配置项 */
  async updateBatch(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const { key, value } of items) {
        await conn.execute(
          'UPDATE configs SET value = ? WHERE `key` = ?',
          [value, key]
        );
      }
      await conn.commit();
      // 清除所有 configs 相关的 Redis 缓存（如果有的话，简单粗暴全清 key pattern）
      const { getRedis, REDIS_KEYS } = require('../config/redis');
      try {
        const redis = await getRedis();
        const keys = await redis.keys('config:*');
        if (keys.length > 0) await redis.del(...keys);
      } catch (_) {
        // Redis 不可用时不影响主流程
      }
    } finally {
      conn.release();
    }
  },
};

module.exports = SystemConfig;
