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
        // 改用 SCAN 游标迭代，避免 KEYS 命令 O(N) 全量扫描阻塞 Redis
        const pattern = 'config:*';
        let cursor = '0';
        const keysToDelete = [];
        do {
          const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
          cursor = nextCursor;
          keysToDelete.push(...batch);
        } while (cursor !== '0');
        if (keysToDelete.length) await redis.del(...keysToDelete);
      } catch (_) {
        // Redis 不可用时不影响主流程
      }
    } finally {
      conn.release();
    }
  },
};

module.exports = SystemConfig;
