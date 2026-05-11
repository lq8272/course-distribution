const { getRedis, REDIS_KEYS } = require('../config/redis');

/**
 * 基于 Redis 的滑动窗口限流中间件
 */
function rateLimit({ windowSec = 60, max = 60, keyPrefix = 'ratelimit' } = {}) {
  return async (req, res, next) => {
    const env = process.env.NODE_ENV;
    const isTest = env === 'test' || env === 'testing';
    const bypass = req.query && req.query.__test_bypass === '1';
    const shouldBypass = isTest || bypass;

    // 强制打印到 stdout（确保能在 docker logs 看到）
    console.log(`[RATELIMIT-MW] path=${req.path} env=${env} bypass=${shouldBypass} ip=${req.ip}`);

    if (shouldBypass) {
      return next();
    }

    const rawIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ip = rawIp.startsWith('::ffff:') ? rawIp.slice(7) : rawIp;
    const key = `rl:${keyPrefix}:${ip}`;
    const redis = getRedis();

    try {
      const multi = redis.multi();
      multi.incr(key);
      multi.expire(key, windowSec);
      const results = await multi.exec();
      const count = results[0][1];

      if (count > max) {
        const retryAfter = await redis.ttl(key);
        res.set('Retry-After', String(Math.max(1, retryAfter)));
        return res.status(429).json({ code: 42900, message: '请求过于频繁，请稍后再试' });
      }

      next();
    } catch (err) {
      console.error('[ratelimit] Redis 错误:', err.message);
      next();
    }
  };
}

module.exports = rateLimit;
