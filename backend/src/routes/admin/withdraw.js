const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const Commission = require('../../models/Commission');
const Notification = require('../../models/Notification');
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/admin');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/admin/withdraw/list
router.get('/list', auth, adminAuth, async (req, res) => {
  try {
    const { status, page = 1, page_size = 20 } = req.query;
    let where = '1=1';
    const params = [];
    if (status !== undefined && status !== '') { where += ' AND w.status = ?'; params.push(parseInt(status)); }
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const [rows, total] = await Promise.all([
      db.query(
        `SELECT w.*, u.nickname as user_nickname
         FROM withdraw_records w LEFT JOIN users u ON u.id = w.user_id
         WHERE ${where} ORDER BY w.id DESC LIMIT ? OFFSET ?`,
        [...params, parseInt(page_size), offset]
      ),
      db.query(`SELECT COUNT(*) as cnt FROM withdraw_records w WHERE ${where}`, params),
    ]);
    ok(res, { rows, total: total[0]?.cnt || 0 });
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/withdraw/:id/approve
router.post('/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      // FOR UPDATE 锁住记录，防止并发重复审批
      const [rows] = await conn.query(
        'SELECT * FROM withdraw_records WHERE id = ? AND status = 0 FOR UPDATE',
        [parseInt(req.params.id)]
      );
      if (!rows.length) {
        await conn.rollback(); conn.release();
        return fail(res, 400, 40000, '记录不存在或已处理');
      }
      // 审批通过：确认提现申请
      // 注意：用户申请提现时（commission/withdraw）已从 commissions 表扣减（status: 1→2），
      // 本步骤仅更新提现记录状态，不涉及余额操作
      await conn.execute(
        'UPDATE withdraw_records SET status = 1, handle_by = ?, handle_time = NOW() WHERE id = ?',
        [req.user.id, parseInt(req.params.id)]
      );
      await conn.commit();
      conn.release();
      // 发送站内通知
      Notification.send(rows[0].user_id, 'withdraw_approved', '提现申请已通过', {
        amount: rows[0].amount,
        withdraw_id: parseInt(req.params.id),
      });
      ok(res, null);
    } catch (e) {
      await conn.rollback(); conn.release();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '操作失败');
  }
});

// POST /api/admin/withdraw/:id/reject
router.post('/:id/reject', auth, adminAuth, async (req, res) => {
  try {
    const { remark } = req.body;
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      const [rows] = await conn.query(
        'SELECT * FROM withdraw_records WHERE id = ? AND status = 0 FOR UPDATE',
        [parseInt(req.params.id)]
      );
      if (!rows.length) {
        await conn.rollback(); conn.release();
        return fail(res, 400, 40000, '记录不存在或已处理');
      }
      // 拒绝时：资金释放 — 恢复佣金记录状态 2→1（已提现→已入账）
      const [withdrawRecord] = rows;
      const refundAmount = parseFloat(withdrawRecord.amount);
      await Commission.revertForWithdraw(conn, withdrawRecord.user_id, refundAmount);
      await conn.execute(
        'UPDATE withdraw_records SET status = 2, handle_by = ?, handle_time = NOW(), remark = ? WHERE id = ?',
        [req.user.id, remark || '', parseInt(req.params.id)]
      );
      await conn.commit();
      conn.release();
      // 发送站内通知（退款至可提现余额）
      Notification.send(rows[0].user_id, 'withdraw_rejected', '提现申请已被拒绝', {
        amount: rows[0].amount,
        remark: remark || '',
        withdraw_id: parseInt(req.params.id),
      });
      ok(res, null);
    } catch (e) {
      await conn.rollback(); conn.release();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '操作失败');
  }
});

module.exports = router;
