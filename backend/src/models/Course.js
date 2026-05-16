const db = require('../config/database');
const videoService = require('../services/video');

const Course = {
  async list({ categoryId, keyword, page = 1, pageSize = 20 }) {
    const safePage = Math.max(1, parseInt(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
    const offset = (safePage - 1) * safePageSize;
    let where = ' WHERE 1=1';
    const params = [];
    if (categoryId) { where += ' AND category_id = ?'; params.push(categoryId); }
    if (keyword) { where += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
    const [rows, total] = await Promise.all([
      db.query(`SELECT * FROM courses ${where} AND is_show = 1 ORDER BY sort DESC, id DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
      db.query(`SELECT COUNT(*) as cnt FROM courses ${where} AND is_show = 1`, params),
    ]);
    // 追加佣金比例字段（基于 agent_levels 三级差额返佣）
    const rates = { DR: 0, DISTRIBUTORDR: 0, MXJ: 0, DISTRIBUTORMXJ: 0, CJHH: 0, DISTRIBUTORCJHH: 0 };
    const allRateRows = await db.query(
      "SELECT level, rebate_rate FROM agent_levels WHERE level IN ('DR','DISTRIBUTORDR','MXJ','DISTRIBUTORMXJ','CJHH','DISTRIBUTORCJHH')"
    );
    allRateRows.forEach(r => { rates[r.level] = parseFloat(r.rebate_rate) || 0; });
    const r1 = rates['DISTRIBUTORDR'] ?? rates['DR'] ?? 0;
    const r2 = rates['DISTRIBUTORMXJ'] ?? rates['MXJ'] ?? 0;
    const r3 = rates['DISTRIBUTORCJHH'] ?? rates['CJHH'] ?? 0;
    rows.forEach(c => {
      if (c.is_distribution) {
        c.commission_ratio = Math.round(r1 * 10000) / 100;
        c.level2_ratio = Math.round(Math.max(0, r2 - r1) * 10000) / 100;
        c.level3_ratio = Math.round(Math.max(0, r3 - r2) * 10000) / 100;
      } else {
        c.commission_ratio = 0;
        c.level2_ratio = 0;
        c.level3_ratio = 0;
      }
      // 封面图签名 URL
      if (c.cover_image) {
        if (c.cover_image.startsWith('images/') || c.cover_image.startsWith('videos/')) {
          c.cover_image_signed_url = videoService.createSignedUrlSync(c.cover_image) || c.cover_image;
        } else {
          c.cover_image_signed_url = c.cover_image;
        }
      }
    });
    return { rows: rows, total: total[0].cnt };
  },

  async findById(id) {
    const rows = await db.query('SELECT * FROM courses WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  },

  async getDetail(id, userId = null) {
    const course = await this.findById(id);
    if (!course) return null;
    // 封面图签名 URL（listAdmin 用同样的逻辑）
    if (course.cover_image) {
      if (course.cover_image.startsWith('images/') || course.cover_image.startsWith('videos/')) {
        course.cover_image_signed_url = videoService.createSignedUrlSync(course.cover_image) || course.cover_image;
      } else {
        course.cover_image_signed_url = course.cover_image;
      }
    }
    // video_key 始终返回给前端（用于按需刷新签名 URL，前端调 videoApi.playUrl(video_key)）
    // video_url 策略：免费课登录可看；已购可看；未购付费课不可看
    if (userId) {
      const [bought, pending] = await Promise.all([
        db.query('SELECT id FROM orders WHERE user_id = ? AND course_id = ? AND status IN (1,2,3) LIMIT 1', [userId, id]),
        db.query('SELECT id FROM orders WHERE user_id = ? AND course_id = ? AND status = 0 LIMIT 1', [userId, id]),
      ]);
      course.is_bought = bought.length > 0;
      course.has_pending_order = pending.length > 0;
      const isFree = course.is_free === 1;
      if (!course.is_bought && !isFree) {
        course.video_url = null; // 未购付费课：无权观看
        course.video_key = null; // video_key 也不暴露
      } else {
        // 已购或免费课，video_url 走传统签名（兼容旧视频），video_key 单独暴露供前端按需调 play-url
        if (course.video_url) {
          course.video_url = videoService.createSignedUrlSync(course.video_url) || course.video_url;
        }
        // video_key 保持原始值，前端用 videoApi.playUrl(video_key) 获取签名播放内容
      }
    } else {
      // 未登录用户：仅免费课可预览（付费课 video_url/video_key 置空）
      if (course.is_free !== 1) {
        course.video_url = null;
        course.video_key = null;
      } else {
        if (course.video_url) {
          course.video_url = videoService.createSignedUrlSync(course.video_url) || course.video_url;
        }
      }
    }
    // 追加佣金比例字段（差额返佣：L2=L2_rate-L1_rate, L3=L3_rate-L2_rate）
    const rateRows = await db.query(
      "SELECT level, rebate_rate FROM agent_levels WHERE level IN ('DR','DISTRIBUTORDR','MXJ','DISTRIBUTORMXJ','CJHH','DISTRIBUTORCJHH')"
    );
    const rates = {};
    rateRows.forEach(r => { rates[r.level] = parseFloat(r.rebate_rate) || 0; });
    const r1 = rates['DR'] ?? rates['DISTRIBUTORDR'] ?? 0;
    const r2 = rates['MXJ'] ?? rates['DISTRIBUTORMXJ'] ?? 0;
    const r3 = rates['CJHH'] ?? rates['DISTRIBUTORCJHH'] ?? 0;
    course.commission_ratio = course.is_distribution ? Math.round(r1 * 10000) / 100 : 0;
    course.level2_ratio = course.is_distribution ? Math.round(Math.max(0, r2 - r1) * 10000) / 100 : 0;
    course.level3_ratio = course.is_distribution ? Math.round(Math.max(0, r3 - r2) * 10000) / 100 : 0;
    return course;
  },

  async categories() {
    return db.query('SELECT * FROM course_category WHERE is_show = 1 ORDER BY sort ASC, id ASC');
  },

  async create(data) {
    const { title, description, cover_image, video_url, video_key, price, is_free, category_id, sort } = data;
    const r = await db.execute(
      'INSERT INTO courses (title, description, cover_image, video_url, video_key, price, is_free, category_id, sort) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        title ?? '',
        description ?? '',
        cover_image ?? '',
        video_url ?? '',
        video_key ?? '',
        price ?? 0,
        is_free ? 1 : 0,
        category_id ?? null,
        sort ?? 0,
      ]
    );
    return r.insertId;
  },

  async update(id, data) {
    const fields = [];
    const vals = [];
    ['title','description','cover_image','video_url','video_key','price','is_free','category_id','sort','is_show'].forEach(k => {
      if (data[k] !== undefined) { fields.push(`${k} = ?`); vals.push(data[k]); }
    });
    if (!fields.length) return;
    vals.push(id);
    return db.execute(`UPDATE courses SET ${fields.join(',')} WHERE id = ?`, vals);
  },

  async listAdmin({ page = 1, pageSize = 20, keyword }) {
    const offset = (page - 1) * pageSize;
    let where = ' WHERE 1=1';
    const params = [];
    if (keyword) {
      where += ' AND (title LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const [rows, total] = await Promise.all([
      db.query(`SELECT * FROM courses ${where} ORDER BY sort DESC, id DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
      db.query(`SELECT COUNT(*) as cnt FROM courses ${where}`, params),
    ]);
    // 封面图转签名 URL（兼容存 key 和存完整 URL 两种情况）
    rows.forEach(c => {
      if (c.cover_image) {
        if (c.cover_image.startsWith('images/') || c.cover_image.startsWith('videos/') ||
            c.cover_image.startsWith('/images/') || c.cover_image.startsWith('/videos/')) {
          c.cover_image_signed_url = videoService.createSignedUrlSync(c.cover_image) || c.cover_image;
        } else {
          // 已经是完整 URL（旧的），保持原样
          c.cover_image_signed_url = c.cover_image;
        }
      }
    });
    return { rows: rows, total: total[0].cnt };
  },

  async delete(id) {
    return db.execute('DELETE FROM courses WHERE id = ?', [id]);
  },
};
module.exports = Course;
