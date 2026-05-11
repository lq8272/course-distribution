const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/user/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return fail(res, 404, 40400, '用户不存在');
    ok(res, {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      phone: user.phone,
      status: user.status,
      is_admin: !!user.is_admin,
      created_at: user.created_at,
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// PUT /api/user/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { nickname, avatar, phone } = req.body;
    const updates = {};
    if (nickname !== undefined) {
      if (nickname.length > 64) return fail(res, 400, 40000, '昵称最长64字符');
      updates.nickname = nickname;
    }
    if (avatar !== undefined) updates.avatar = avatar;
    if (phone !== undefined) {
      if (phone && !/^1\d{10}$/.test(phone)) return fail(res, 400, 40000, '手机号格式错误');
      updates.phone = phone;
    }
    if (Object.keys(updates).length === 0) return fail(res, 400, 40000, '无有效字段更新');

    await User.update(req.user.id, updates);
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '更新失败');
  }
});

module.exports = router;
