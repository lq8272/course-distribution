const db = require('../config/database');

const Team = {
  // 查询某用户的直接上级
  async findParent(userId) {
    const rows = await db.query(
      'SELECT t.*, u.nickname FROM teams t LEFT JOIN users u ON u.id = t.parent_id WHERE t.user_id = ? LIMIT 1',
      [userId]
    );
    return rows[0] || null;
  },

  // 查询直接下级（只查一层）
  async findChildren(userId) {
    return db.query(
      'SELECT t.*, u.nickname FROM teams t LEFT JOIN users u ON u.id = t.user_id WHERE t.parent_id = ?',
      [userId]
    );
  },

  // 递归查询团队树（depth < maxDepth + LIMIT 1000 防深递归/海量数据）
  // 若下级人数超过 1000 人，返回 is_truncated = true 供前端分批加载
  // page/pageSize 分页：外层 LIMIT/OFFSET，外层 count(*) OVER() 取 total
  // depthFilter: 只取指定深度的节点（1 = 直属下级）
  async findTree(userId, { maxDepth = 10, page = 1, pageSize = 20, depthFilter = null } = {}) {
    const offset = (page - 1) * pageSize;
    const depthClause = depthFilter !== null ? `AND d.depth = ${parseInt(depthFilter, 10)}` : '';
    const rows = await db.query(
      `WITH RECURSIVE tree AS (
         SELECT user_id, parent_id, root_id, 0 as depth
         FROM teams WHERE user_id = ?
         UNION ALL
         SELECT t.user_id, t.parent_id, t.root_id, d.depth + 1
         FROM teams t
         JOIN tree d ON t.parent_id = d.user_id
         WHERE d.depth < ? ${depthClause}
         LIMIT 1000
       ),
       counted AS (
         SELECT tree.*, u.nickname, COUNT(*) OVER() as total
         FROM tree
         LEFT JOIN users u ON u.id = tree.user_id
       )
       SELECT * FROM counted LIMIT ? OFFSET ?`,
      [userId, maxDepth, pageSize, offset]
    );
    const is_truncated = rows.length >= 1000;
    const total = rows[0]?.total ?? (rows.length < pageSize && !is_truncated ? rows.length : null);
    return { list: rows.map(r => ({ total: undefined, ...r })), is_truncated, total, page, pageSize };
  },

  // 团队统计（总人数、本月新增、业绩）
  async stats(userId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 19);

    const [rows, performanceRows] = await Promise.all([
      db.query(
        `WITH RECURSIVE tree AS (
           SELECT user_id, parent_id, root_id, 0 as depth
           FROM teams WHERE user_id = ?
           UNION ALL
           SELECT t.user_id, t.parent_id, t.root_id, d.depth + 1
           FROM teams t JOIN tree d ON t.parent_id = d.user_id
           WHERE d.depth < 10
         )
         SELECT root_id, COUNT(*) as cnt FROM tree GROUP BY root_id`,
        [userId]
      ),
      db.query(
        `SELECT COALESCE(SUM(c.amount), 0) as total_performance
         FROM commissions c
         WHERE c.user_id = ? AND c.status != 3`,
        [userId]
      ),
    ]);

    const total = rows.reduce((s, r) => s + r.cnt, 0);
    const total_performance = parseFloat(performanceRows[0]?.total_performance || 0);

    // 本月新增：当前用户的直接下级中，本月注册的人数
    const monthNewRows = await db.query(
      `SELECT COUNT(*) as cnt FROM teams WHERE parent_id = ? AND created_at >= ?`,
      [userId, startOfMonth]
    );
    const month_new = monthNewRows[0]?.cnt || 0;

    return { total, month_new, total_performance, byRootId: rows };
  },
};
module.exports = Team;
