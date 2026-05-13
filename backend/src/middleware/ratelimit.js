const { getRedis, REDIS_KEYS } = require('../config/redis');

/**
 * 基于 Redis 的滑动窗口限流中间件
 */
function rateLimit({ windowSec = 60, max = 60, keyPrefix = 'ratelimit' } = {}) {
  return async (req, res, next) => {
    const env = process.env.NODE_ENV;
    const isTest = env === 'test' || env === 'testing';

    // 生产环境不打印限流日志，避免stdout污染 + 暴露IP
    if (env !== 'production') {
      console.log(`[RATELIMIT-MW] path=${req.path} env=${env} ip=${req.ip}`);
    }

    if (isTest) {
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
      // Redis 故障时拒绝请求，而非静默放行，防止滥用
      return res.status(503).json({ code: 50300, message: '服务暂时不可用，请稍后再试' });
    }
  };
}

module.exports = rateLimit;
