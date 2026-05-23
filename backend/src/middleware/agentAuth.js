const jwt = require('jsonwebtoken');
const config = require('../config');
const ServiceAgent = require('../models/ServiceAgent');

/**
 * 客服认证中间件
 * 验证 Bearer token，设置 req.agent
 */
async function agentAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ code: 40100, message: '未登录' });
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.type !== 'service_agent') {
      return res.status(403).json({ code: 40300, message: '非客服账号' });
    }
    const agent = await ServiceAgent.findById(decoded.id);
    if (!agent || !agent.status) {
      return res.status(401).json({ code: 40100, message: '账号无效或已停用' });
    }
    req.agent = agent;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 40101, message: '登录已过期' });
    }
    return res.status(401).json({ code: 40100, message: '无效凭证' });
  }
}

module.exports = agentAuth;
