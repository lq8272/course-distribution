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

  // 追加签名 URL（内部用）
  _signCover(course) {
    if (course && course.cover_image) {
      if (course.cover_image.startsWith('images/') || course.cover_image.startsWith('videos/')) {
        course.cover_image_signed_url = videoService.createSignedUrlSync(course.cover_image) || course.cover_image;
      } else {
        course.cover_image_signed_url = course.cover_image;
      }
    }
    return course;
  },

  // 根据 video_key 生成签名 URL
  _signVideoKey(videoKey) {
    if (!videoKey) return null;
    if (!videoService.isConfigured()) return videoKey;
    if (videoKey.endsWith('.m3u8')) {
      return videoService.createSignedUrlSync(videoKey);
    }
    return videoService.createSignedUrlSync(videoKey);
  },

  async getDetail(id, userId = null) {
    const course = await this.findById(id);
    if (!course) return null;
    this._signCover(course);

    // 查询关联视频列表
    const videos = await this.getVideosByCourseId(id);

    // video_key/video_url 策略：视频列表已完整返回，前端按需请求签名 URL
    // 未登录/未购买用户：只返回 is_preview=1 的试看视频
    if (userId) {
      const [bought, pending] = await Promise.all([
        db.query('SELECT id FROM orders WHERE user_id = ? AND course_id = ? AND status IN (1,2,3) LIMIT 1', [userId, id]),
        db.query('SELECT id FROM orders WHERE user_id = ? AND course_id = ? AND status = 0 LIMIT 1', [userId, id]),
      ]);
      course.is_bought = bought.length > 0;
      course.has_pending_order = pending.length > 0;
      // 已购/免费/管理员：返回全部可用视频；未购：返回全部可用视频（购买前可见列表）
      course.videos = videos.filter(v => v.video_status === 2);
    } else {
      // 未登录：返回全部可用视频（购买前可见列表）
      course.videos = videos.filter(v => v.video_status === 2);
    }

    // 追加佣金比例
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

  // 查询课程的全部视频
  async getVideosByCourseId(courseId) {
    const rows = await db.query(
      'SELECT id, course_id, title, description, video_key, video_url, video_status, duration, sort, is_preview, created_at, updated_at FROM course_videos WHERE course_id = ? ORDER BY sort ASC, id ASC',
      [courseId]
    );
    // 追加 video_key 的签名 URL
    rows.forEach(v => {
      v.video_key_signed_url = this._signVideoKey(v.video_key);
      v.video_url_signed_url = this._signVideoKey(v.video_url);
    });
    return rows;
  },

  async categories() {
    return db.query('SELECT * FROM course_categories WHERE is_show = 1 ORDER BY sort ASC, id ASC');
  },

  async create(data) {
    const { title, description, cover_image, video_url, video_key, price, is_free, category_id, sort, is_distribution, is_hot, hot_commission_rate, videos } = data;
    const r = await db.execute(
      'INSERT INTO courses (title, description, cover_image, video_url, video_key, price, original_price, is_free, category_id, sort, is_distribution, is_hot, hot_commission_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        title ?? '',
        description ?? '',
        cover_image ?? '',
        video_url ?? '',
        video_key ?? '',
        price ?? 0,
        data.original_price ?? 0,
        is_free ? 1 : 0,
        category_id ?? null,
        sort ?? 0,
        (is_distribution || is_hot) ? 1 : 0,
        is_hot ? 1 : 0,
        is_hot ? (hot_commission_rate ?? 0) : 0,
      ]
    );
    const courseId = r.insertId;
    // 批量写入视频记录
    if (Array.isArray(videos) && videos.length) {
      await this.createVideos(courseId, videos);
    }
    return courseId;
  },

  async update(id, data) {
    const fields = [];
    const vals = [];
    ['title','description','cover_image','video_url','video_key','price','original_price','is_free','category_id','sort','is_show','is_distribution','is_hot','hot_commission_rate'].forEach(k => {
      if (data[k] !== undefined) { fields.push(`${k} = ?`); vals.push(data[k]); }
    });
    if (data.is_hot) { fields.push('is_distribution = 1'); }
    if (!fields.length) return;
    vals.push(id);
    await db.execute(`UPDATE courses SET ${fields.join(',')} WHERE id = ?`, vals);
    // 全量替换视频列表
    if (data.videos !== undefined) {
      await this.replaceVideos(id, data.videos);
    }
  },

  // ========== course_videos CRUD ==========

  // 批量创建视频记录（课程创建时）
  async createVideos(courseId, videos) {
    if (!Array.isArray(videos) || !videos.length) return;
    for (const v of videos) {
      await db.execute(
        'INSERT INTO course_videos (course_id, title, description, video_key, video_status, duration, sort, is_preview) VALUES (?,?,?,?,?,?,?,?)',
        [courseId, v.title ?? '', v.description ?? '', v.video_key ?? '', v.video_status ?? 0, v.duration ?? 0, v.sort ?? 0, v.is_preview ? 1 : 0]
      );
    }
  },

  // 全量替换视频列表（课程编辑时）
  async replaceVideos(courseId, videos) {
    // 删除旧记录（同时删除七牛文件需要单独处理，这里只删数据库）
    const [existing] = await db.query('SELECT video_key FROM course_videos WHERE course_id = ?', [courseId]);
    await db.execute('DELETE FROM course_videos WHERE course_id = ?', [courseId]);
    // 重新插入
    if (Array.isArray(videos) && videos.length) {
      for (const v of videos) {
        await db.execute(
          'INSERT INTO course_videos (course_id, title, description, video_key, video_url, video_status, duration, sort, is_preview) VALUES (?,?,?,?,?,?,?,?,?)',
          [
            courseId,
            v.title ?? '',
            v.description ?? '',
            v.video_key ?? '',
            v.video_url ?? '',
            v.video_status ?? 0,
            v.duration ?? 0,
            v.sort ?? 0,
            v.is_preview ? 1 : 0,
          ]
        );
      }
    }
  },

  // 根据 video_key 查找 course_videos 记录
  async findVideoByKey(videoKey) {
    const rows = await db.query('SELECT * FROM course_videos WHERE video_key = ? LIMIT 1', [videoKey]);
    return rows[0] || null;
  },

  // 更新 course_videos 的 video_url 和 video_status（转码完成后回调）
  async updateVideoUrl(videoKey, videoUrl, duration) {
    const fields = ['video_url = ?', 'video_status = 2'];
    const vals = [videoUrl];
    if (duration && duration > 0) fields.push('duration = ?'), vals.push(duration);
    vals.push(videoKey);
    return db.execute(`UPDATE course_videos SET ${fields.join(',')} WHERE video_key = ?`, vals);
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
      db.query(`SELECT c.*, (SELECT COUNT(*) FROM course_videos cv WHERE cv.course_id = c.id) as video_count FROM courses c ${where} ORDER BY c.sort DESC, c.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]),
      db.query(`SELECT COUNT(*) as cnt FROM courses ${where}`, params),
    ]);
    rows.forEach(c => {
      if (c.cover_image) {
        if (c.cover_image.startsWith('images/') || c.cover_image.startsWith('videos/') ||
            c.cover_image.startsWith('/images/') || c.cover_image.startsWith('/videos/')) {
          c.cover_image_signed_url = videoService.createSignedUrlSync(c.cover_image) || c.cover_image;
        } else {
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
