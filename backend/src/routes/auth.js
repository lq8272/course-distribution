const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const config = require('../config');
const User = require('../models/User');
const Agent = require('../models/Agent');
const { getRedis, REDIS_KEYS, checkConnection } = require('../config/redis');

const ok = (res, data, message = '成功') => res.json({ code: 0, data, message });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// POST /api/auth/login 微信登录
router.post('/login', async (req, res) => {
  try {
    const { code, nickname } = req.body;
    if (!code) return fail(res, 400, 40000, 'code不能为空');

    // 调用微信接口换取 openid
    let openid;
    if (code && code.startsWith('test_')) {
      // 测试模式：code 格式为 test_<openid>
      openid = code;
    } else {
      // 正式：微信 code2session 接口
      const appid = config.wechat.appid;
      const secret = config.wechat.secret;
      const wxRes = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
      );
      const wxData = await wxRes.json();
      if (!wxData.openid) {
        console.error('[auth/login] 微信接口返回错误:', wxData);
        return fail(res, 400, 40001, '微信登录失败，请稍后重试');
      }
      openid = wxData.openid;
    }

    const user = await User.findOrCreateByOpenid(openid, nickname || '微信用户', req.body.promotion_code);
    const agent = await Agent.findActive(user.id);

    const jti = crypto.randomUUID().replace(/-/g, '');
    const token = jwt.sign(
      { jti, id: user.id, is_admin: !!user.is_admin },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    const refreshToken = jwt.sign(
      { jti, id: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    // refresh_token 存 Redis（O4）- Redis 不可用时 fail-secure：拒绝登录
    const redisOk = await checkConnection();
    if (!redisOk) {
      console.error('[auth/login] Redis 不可用，拒绝登录');
      return fail(res, 503, 50301, '认证服务暂不可用，请稍后重试');
    }
    await getRedis().set(REDIS_KEYS.REFRESH_TOKEN(user.id), refreshToken, 'EX', 7 * 86400);

    ok(res, { user: { id: user.id, nickname: user.nickname, openid: user.openid, is_admin: !!user.is_admin, is_agent: !!agent }, token, refreshToken });
  } catch (err) {
    console.error('[auth/login]', err);
    return fail(res, 500, 50000, '登录失败');
  }
});

// POST /api/auth/refresh Token 续期（O4）
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return fail(res, 400, 40000, 'refreshToken不能为空');

    let payload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (err) {
      // 明确区分：Token格式错误/已过期/其他
      const msg = err.name === 'TokenExpiredError' ? 'refreshToken已过期'
        : err.name === 'JsonWebTokenError' ? 'refreshToken格式错误'
        : 'refreshToken无效或已过期';
      return fail(res, 401, 40101, msg);
    }

    // Redis 不可用时 fail-secure：拒绝续期请求
    const redisOk = await checkConnection();
    if (!redisOk) {
      console.error('[auth/refresh] Redis 不可用，拒绝续期请求');
      return fail(res, 503, 50301, '认证服务暂不可用，请稍后重试');
    }

    // 检查 Redis 中是否还有（未被动销毁）
    const stored = await getRedis().get(REDIS_KEYS.REFRESH_TOKEN(payload.id));
    if (stored !== refreshToken) return fail(res, 401, 40102, 'refreshToken已被使用或失效');

    // 删除旧 refresh token（单次使用）
    await getRedis().del(REDIS_KEYS.REFRESH_TOKEN(payload.id));

    // 生成新 token 和新 refresh token
    const newJti = crypto.randomUUID().replace(/-/g, '');
    const newToken = jwt.sign(
      { jti: newJti, id: payload.id, is_admin: payload.is_admin || false },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    const newRefreshToken = jwt.sign(
      { jti: newJti, id: payload.id, is_admin: payload.is_admin || false },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
    await getRedis().set(REDIS_KEYS.REFRESH_TOKEN(payload.id), newRefreshToken, 'EX', 7 * 86400);
    ok(res, { token: newToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[auth/refresh]', err);
    return fail(res, 500, 50000, '续期失败');
  }
});

// POST /api/auth/logout 登出（O4：加入黑名单 + 删除 refresh token）
router.post('/logout', async (req, res) => {
  try {
    const { token, refreshToken } = req.body;

    // Redis 不可用时 fail-secure：拒绝登出请求，防止残留 token 仍然有效
    const redisOk = await checkConnection();
    if (!redisOk) {
      console.error('[auth/logout] Redis 不可用，拒绝登出请求');
      return fail(res, 503, 50301, '认证服务暂不可用，请稍后重试');
    }

    // 1. 黑名单 access token（必须用 jwt.verify 验证签名，防止伪造 jti/exp）
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwt.secret);
        if (payload && payload.jti) {
          const ttl = payload.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await getRedis().set(REDIS_KEYS.TOKEN_BLACKLIST(payload.jti), '1', 'EX', ttl);
          }
        }
      } catch (err) {
        console.warn('[auth/logout] access token verify failed:', err.message);
      }
    }

    // 2. 删除 refresh token
    if (refreshToken) {
      try {
        const payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
        if (payload && payload.id) {
          await getRedis().del(REDIS_KEYS.REFRESH_TOKEN(payload.id));
        }
      } catch (err) {
        console.warn('[auth/logout] refresh token verify failed:', err.message);
      }
    }

    ok(res, null, '已退出');
  } catch (err) {
    return fail(res, 500, 50000, '退出失败');
  }
});

// GET /api/auth/userinfo
router.get('/userinfo', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return fail(res, 404, 40400, '用户不存在');
    ok(res, { id: user.id, nickname: user.nickname, is_admin: !!user.is_admin, openid: user.openid });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '获取用户信息失败');
  }
});

module.exports = router;
