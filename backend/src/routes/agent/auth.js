const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const ServiceAgent = require('../../models/ServiceAgent');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// POST /api/agent/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return fail(res, 400, 40000, '账号密码不能为空');

    const agent = await ServiceAgent.findByUsername(username);
    if (!agent) return fail(res, 401, 40100, '账号或密码错误');

    const ok_pwd = await ServiceAgent.verifyPassword(password, agent.password);
    if (!ok_pwd) return fail(res, 401, 40100, '账号或密码错误');

    await ServiceAgent.setOnline(agent.id, true);

    const token = jwt.sign(
      { jti: crypto.randomUUID().replace(/-/g, ''), id: agent.id, type: 'service_agent' },
      config.jwt.secret,
      { expiresIn: '12h' }
    );
    ok(res, {
      token,
      agent: {
        id: agent.id,
        username: agent.username,
        nickname: agent.nickname,
        avatar: agent.avatar,
      }
    });
  } catch (err) {
    console.error('[agent/login]', err);
    return fail(res, 500, 50000, '登录失败');
  }
});

// POST /api/agent/logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        if (decoded.type === 'service_agent') {
          await ServiceAgent.setOnline(decoded.id, false);
        }
      } catch (_) {}
    }
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '登出失败');
  }
});

// GET /api/agent/info
router.get('/info', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return fail(res, 401, 40100, '未登录');
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== 'service_agent') return fail(res, 403, 40300, '非客服账号');
    const agent = await ServiceAgent.findById(decoded.id);
    if (!agent) return fail(res, 401, 40100, '账号不存在');
    const handling = await ServiceAgent.handlingCount(agent.id);
    ok(res, { ...agent, handling_count: handling });
  } catch (err) {
    return fail(res, 401, 40100, '未登录');
  }
});

module.exports = router;
