const express = require('express');
const router = express.Router();

// 导入子路由
const adminAuthRoutes = require('./admin/auth');
const adminAgentRoutes = require('./admin/agent');
const adminOrderRoutes = require('./admin/order');
const adminUserRoutes = require('./admin/user');
const adminWithdrawRoutes = require('./admin/withdraw');
const adminConfigRoutes = require('./admin/config');
const adminStatsRoutes = require('./admin/stats');
const adminPurchaseRoutes = require('./admin/purchase');
const adminServiceRoutes = require('./admin/service');

// 挂载子路由
router.use('/auth', adminAuthRoutes);
router.use('/agent', adminAgentRoutes);
router.use('/order', adminOrderRoutes);
router.use('/user', adminUserRoutes);
router.use('/withdraw', adminWithdrawRoutes);
router.use('/config', adminConfigRoutes);
router.use('/stats', adminStatsRoutes);
router.use('/purchase', adminPurchaseRoutes);
router.use('/service', adminServiceRoutes);

module.exports = router;
