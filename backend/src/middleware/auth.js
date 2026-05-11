const jwt = require('jsonwebtoken');
const config = require('../config');
const { getRedis, REDIS_KEYS, checkConnection } = require('../config/redis');

// 兼容 destructure 写法：同时导出 auth 作为 named export
const authMiddleware = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ code: 40100, message: '未提供Token' });
    }
    const token = auth.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      return res.status(401).json({ code: 40101, message: 'Token无效或已过期' });
    }

    if (payload.jti) {
      const redisOk = await checkConnection();
      if (!redisOk) {
        console.error('[auth] Redis 不可用，fail-secure：拒绝所有 Token');
        return res.status(503).json({ code: 50301, message: '认证服务暂不可用，请稍后重试' });
      }
      const blacklisted = await getRedis().get(REDIS_KEYS.TOKEN_BLACKLIST(payload.jti));
      if (blacklisted) {
        return res.status(401).json({ code: 40102, message: 'Token已失效' });
      }
    }

    req.user = { id: payload.id, is_admin: payload.is_admin || false };
    next();
  } catch (err) {
    console.error('[auth middleware]', err);
    res.status(500).json({ code: 50000, message: '认证失败' });
  }
};

module.exports = authMiddleware;
module.exports.auth = authMiddleware;

module.exports.optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    const token = authHeader.slice(7);
    let payload;
    try {
      // 先 verify 再取值（不用 decode，避免签名验证前已被赋值）
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      req.user = null;
      return next();
    }

    // O4：检查黑名单（Redis 不可用时 fail-secure：降级为未登录，不放行）
    if (payload.jti) {
      const redisOk = await checkConnection();
      if (!redisOk) {
        console.error('[optionalAuth] Redis 不可用，fail-secure：降级为未登录');
        req.user = null;
        return next();
      }
      const blacklisted = await getRedis().get(REDIS_KEYS.TOKEN_BLACKLIST(payload.jti));
      if (blacklisted) {
        req.user = null;
        return next();
      }
    }

    req.user = { id: payload.id, is_admin: payload.is_admin || false };
    next();
  } catch (err) {
    console.error('[optionalAuth middleware]', err);
    req.user = null;
    next();
  }
};

module.exports.adminAuth = async (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ code: 40300, message: '无权限' });
  }
  next();
};
