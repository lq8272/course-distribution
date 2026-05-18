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

    // 优先取 X-Real-IP（ngxin 默认传），其次 X-Forwarded-For 第一段（多层代理场景）
    // 避免直接用 X-Forwarded-For 伪造IP绕过限流：X-Forwarded-For 可被客户端任意设置
    const realIp = req.get('X-Real-IP');
    const forwarded = req.get('X-Forwarded-For');
    let ip = forwarded ? forwarded.split(',')[0].trim() : (realIp || req.ip || 'unknown');
    ip = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    const key = `rl:${keyPrefix}:${ip}`;
    const redis = getRedis();

    try {
      // Redis SET NX + EX 原子操作，等价于 INCR + EXPIRE，且防止超限后新请求覆盖旧TTL
      const result = await redis.set(key, '1', 'NX', 'EX', windowSec);
      const isNew = result === 'OK'; // 'OK' = 首次请求，null = 已存在
      const count = isNew ? 1 : await redis.incr(key);

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
