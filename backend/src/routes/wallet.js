const express = require('express');
const router = express.Router();
const Commission = require('../models/Commission');
const auth = require('../middleware/auth');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/v1/wallet/info 钱包/余额信息
router.get('/info', auth, async (req, res) => {
  try {
    const stats = await Commission.stats(req.user.id);
    ok(res, {
      balance: stats.available,
      withdrawable: stats.withdrawable,
      total_commission: stats.total_commission,
      total_withdrawn: stats.withdrawn,
      pending: stats.pending,
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

module.exports = router;
