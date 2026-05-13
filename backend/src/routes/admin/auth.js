const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const config = require('../../config');
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/admin');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// POST /api/admin/login（R5：管理员密码登录，bcrypt校验）
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return fail(res, 400, 40000, '账号密码不能为空');

    // 直接用 username（手机号或编号）精确查管理员账号，无需遍历全表
    const user = await User.findAdminByCredentials(username, password);
    if (!user) return fail(res, 401, 40100, '账号或密码错误');

    const token = jwt.sign(
      { jti: crypto.randomUUID().replace(/-/g, ''), id: user.id, is_admin: true },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    ok(res, { token, user: { id: user.id, nickname: user.nickname, is_admin: true } });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '登录失败');
  }
});

// POST /api/admin/user/password 设置管理员密码（R5）
router.post('/user/password', auth, adminAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return fail(res, 400, 40000, '密码至少6位');
    const hashed = await new Promise((resolve, reject) => {
      bcrypt.hash(password, 10, (err, result) => {
        if (err) reject(err); else resolve(result);
      });
    });
    await User.updateAdminPassword(req.user.id, hashed);
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '设置失败');
  }
});

module.exports = router;
