// 管理员权限中间件（每次从数据库重新验证 is_admin，防止权限撤销后 Token 仍可用）
const User = require('../models/User');
module.exports = async (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ code: 40300, message: '需要管理员权限' });
  }
  // 从数据库重新验证 is_admin，确保管理员资格被撤销后 Token 即时失效
  const user = await User.findById(req.user.id);
  if (!user || !user.is_admin) {
    return res.status(403).json({ code: 40300, message: '管理员权限已撤销' });
  }
  next();
};
