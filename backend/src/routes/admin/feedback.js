const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const auth = require('../../middleware/auth');
const adminAuth = require('../../middleware/auth').adminAuth;

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// 手机号脱敏
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

// GET /api/admin/feedbacks 反馈列表（管理员）
router.get('/', auth, adminAuth, async (req, res) => {
  try {
    const { status, type, keyword, page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    let sql = `SELECT f.*, u.nickname as user_nickname, u.phone as user_phone
               FROM feedbacks f
               LEFT JOIN users u ON u.id = f.user_id
               WHERE 1=1`;
    const params = [];
    if (status !== undefined) { sql += ' AND f.status = ?'; params.push(Number(status)); }
    if (type) { sql += ' AND f.type = ?'; params.push(type); }
    if (keyword) {
      sql += ' AND (u.nickname LIKE ? OR u.phone LIKE ? OR f.content LIKE ?)';
      const kw = '%' + keyword.trim() + '%';
      params.push(kw, kw, kw);
    }
    sql += ' ORDER BY f.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), offset);
    const rows = await db.query(sql, params);
    const masked = rows.map(r => ({ ...r, user_phone: maskPhone(r.user_phone) }));

    const cntSql = `SELECT COUNT(*) as total FROM feedbacks f LEFT JOIN users u ON u.id = f.user_id WHERE 1=1` +
      (status !== undefined ? ' AND f.status = ' + Number(status) : '') +
      (type ? ' AND f.type = \'' + type + '\'' : '') +
      (keyword ? ' AND (u.nickname LIKE \'%' + keyword.trim() + '%\' OR u.phone LIKE \'%' + keyword.trim() + '%\' OR f.content LIKE \'%' + keyword.trim() + '%\')' : '');
    const [{ total }] = await db.query(cntSql);
    ok(res, { rows: masked, total });
  } catch (err) {
    console.error('[admin/feedbacks]', err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// GET /api/admin/feedbacks/:id 反馈详情
router.get('/:id', auth, adminAuth, async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT f.*, u.nickname as user_nickname, u.phone as user_phone
       FROM feedbacks f LEFT JOIN users u ON u.id = f.user_id
       WHERE f.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return fail(res, 404, 40400, '反馈不存在');
    const r = rows[0];
    r.user_phone = maskPhone(r.user_phone);
    ok(res, r);
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

// PUT /api/admin/feedbacks/:id/reply 处理反馈（回复）
router.put('/:id/reply', auth, adminAuth, async (req, res) => {
  try {
    const { reply, status } = req.body;
    if (!reply || !reply.trim()) return fail(res, 400, 40000, '回复内容不能为空');
    if (reply.trim().length > 1000) return fail(res, 400, 40000, '回复过长');
    const newStatus = status !== undefined ? Number(status) : 2; // 默认改为"已处理"
    if (![0, 1, 2, 3].includes(newStatus)) return fail(res, 400, 40000, '状态非法');

    const r = await db.query(
      `UPDATE feedbacks SET handler_id = ?, reply = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [req.user.id, reply.trim(), newStatus, req.params.id]
    );
    const affected = r.affectedRows !== undefined ? r.affectedRows : (r[0] ? r[0].affectedRows : 0);
    if (affected === 0) return fail(res, 404, 40400, '反馈不存在');
    ok(res, null);
  } catch (err) {
    return fail(res, 500, 50000, '处理失败');
  }
});

// GET /api/admin/feedbacks/stats 统计
router.get('/stats/summary', auth, adminAuth, async (req, res) => {
  try {
    const [total] = await db.query(`SELECT COUNT(*) as n FROM feedbacks`);
    const [pending] = await db.query(`SELECT COUNT(*) as n FROM feedbacks WHERE status = 0`);
    const [replied] = await db.query(`SELECT COUNT(*) as n FROM feedbacks WHERE status = 2`);
    const [ignored] = await db.query(`SELECT COUNT(*) as n FROM feedbacks WHERE status = 3`);
    ok(res, {
      total: total[0] ? total[0].n : 0,
      pending: pending[0] ? pending[0].n : 0,
      replied: replied[0] ? replied[0].n : 0,
      ignored: ignored[0] ? ignored[0].n : 0,
    });
  } catch (err) {
    return fail(res, 500, 50000, '查询失败');
  }
});

module.exports = router;
