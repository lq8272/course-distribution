// 管理员权限中间件
module.exports = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ code: 40300, message: '需要管理员权限' });
  }
  next();
};
