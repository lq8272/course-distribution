const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth, adminAuth } = require('../middleware/auth');

const ok = (res, data) => res.json({ code: 0, data, message: '成功' });
const fail = (res, httpCode, appCode, msg) => res.status(httpCode).json({ code: appCode, message: msg });

// GET /api/admin/category/list
router.get('/list', auth, adminAuth, async (req, res) => {
  try {
    const rows = await db.query('SELECT * FROM course_category ORDER BY sort ASC, id ASC');
    ok(res, rows);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '查询失败');
  }
});

// POST /api/admin/category
router.post('/', auth, adminAuth, async (req, res) => {
  try {
    const { name, parent_id, sort = 0, is_show = 1 } = req.body;
    if (!name) return fail(res, 400, 40000, 'name不能为空');
    const r = await db.execute(
      'INSERT INTO course_category (name, parent_id, sort, is_show) VALUES (?, ?, ?, ?)',
      [name.trim(), parent_id || null, parseInt(sort), parseInt(is_show)]
    );
    ok(res, { id: r.insertId });
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '创建失败');
  }
});

// PUT /api/admin/category/:id
router.put('/:id', auth, adminAuth, async (req, res) => {
  try {
    const { name, parent_id, sort, is_show } = req.body;
    const fields = [], params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name.trim()); }
    if (parent_id !== undefined) { fields.push('parent_id = ?'); params.push(parent_id || null); }
    if (sort !== undefined) { fields.push('sort = ?'); params.push(parseInt(sort)); }
    if (is_show !== undefined) { fields.push('is_show = ?'); params.push(parseInt(is_show)); }
    if (!fields.length) return fail(res, 400, 40000, '无更新字段');
    params.push(parseInt(req.params.id));
    await db.execute(`UPDATE course_category SET ${fields.join(', ')} WHERE id = ?`, params);
    ok(res, null);
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '更新失败');
  }
});

// DELETE /api/admin/category/:id
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const conn = await db.getConnection();
    await conn.beginTransaction();
    try {
      // 检查是否有子分类（在事务内加锁，防止 TOCTOU 竞态）
      const [children] = await conn.query(
        'SELECT id FROM course_category WHERE parent_id = ? LIMIT 1 FOR UPDATE',
        [id]
      );
      if (children.length) {
        await conn.rollback(); conn.release();
        return fail(res, 400, 40000, '该分类下存在子分类，请先删除子分类');
      }
      await conn.execute('DELETE FROM course_category WHERE id = ?', [id]);
      await conn.commit();
      conn.release();
      ok(res, null);
    } catch (e) {
      await conn.rollback(); conn.release();
      throw e;
    }
  } catch (err) {
    console.error(err);
    return fail(res, 500, 50000, '删除失败');
  }
});

module.exports = router;
