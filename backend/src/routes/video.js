/**
 * 七牛云 VOD 路由
 *
 * POST /api/video/upload-token  — 管理员请求上传凭证
 * GET  /api/video/play-url/:key — 获取私有bucket签名播放URL
 * POST /api/video/notify        — 七牛转码完成回调（无需登录）
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const videoService = require('../services/video');
const db = require('../config/database');
const config = require('../config');
const { getRedis } = require('../config/redis');

// GET /api/video/list 视频列表（返回有视频的课程）
router.get('/list', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const rows = await db.query(
      `SELECT id, title, cover_image, video_key, video_url, price, is_free
       FROM courses
       WHERE (video_key IS NOT NULL AND video_key != '') OR (video_url IS NOT NULL AND video_url != '')
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [parseInt(page_size), offset]
    );
    const total = await db.query(
      `SELECT COUNT(*) as cnt FROM courses
       WHERE (video_key IS NOT NULL AND video_key != '') OR (video_url IS NOT NULL AND video_url != '')`
    );
    const totalCnt = Array.isArray(total) ? (total[0]?.cnt ?? 0) : (total?.cnt ?? 0);
    return res.json({ code: 0, data: { rows, total: totalCnt }, message: '成功' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ code: 50000, message: '查询失败' });
  }
});

// ==================== 上传凭证 ====================
// POST /api/video/upload-token
// Body: { course_id, filename }
// 返回: { token, key, expires }
router.post('/upload-token', auth, async (req, res) => {
  try {
    // 只有管理员可以上传视频
    if (!req.user.is_admin) {
      return res.status(403).json({ code: 40300, message: '需要管理员权限' });
    }

    const { course_id, filename } = req.body;
    if (!course_id || !filename) {
      return res.status(400).json({ code: 40000, message: '缺少 course_id 或 filename' });
    }

    // 校验课程存在性，防止伪造 course_id 上传到不存在课程目录
    const [courses] = await db.query('SELECT id FROM courses WHERE id = ? LIMIT 1', [parseInt(course_id)]);
    const course = Array.isArray(courses) ? courses[0] : courses;
    if (!course) {
      return res.status(404).json({ code: 40400, message: '课程不存在' });
    }

    // 生成七牛存储key
    const key = videoService.generateVideoKey(course_id, filename);
    const { token, key: returnedKey, expires } = videoService.createUploadToken(key);

    res.json({ code: 0, data: { token, key: returnedKey, expires }, message: '成功' });
  } catch (err) {
    console.error('[video/upload-token]', err.message);
    res.status(500).json({ code: 50000, message: err.message || '获取上传凭证失败' });
  }
});

// POST /api/video/upload-token (图片版，限制图片类型)
// Body: { course_id, filename }
// 返回: { token, key, expires }
router.post('/image-token', auth, async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ code: 40300, message: '需要管理员权限' });
    }

    const { course_id, filename } = req.body;
    if (!course_id || !filename) {
      return res.status(400).json({ code: 40000, message: '缺少 course_id 或 filename' });
    }

    // 校验课程存在性
    const [courses] = await db.query('SELECT id FROM courses WHERE id = ? LIMIT 1', [parseInt(course_id)]);
    const course = Array.isArray(courses) ? courses[0] : courses;
    if (!course) {
      return res.status(404).json({ code: 40400, message: '课程不存在' });
    }

    // 生成图片key
    const key = videoService.generateImageKey(course_id, filename);
    const { token, key: returnedKey, expires } = videoService.createImageUploadToken(key);

    res.json({ code: 0, data: { token, key: returnedKey, expires }, message: '成功' });
  } catch (err) {
    console.error('[video/image-token]', err.message);
    res.status(500).json({ code: 50000, message: err.message || '获取上传凭证失败' });
  }
});

// ==================== 上传成功后通知后端 ====================
// POST /api/video/uploaded
// 前端上传MP4到七牛成功后调用，触发PFOP转码
// Body: { course_id, mp4_key }
// 返回: { status, persistent_id }
router.post('/uploaded', auth, adminAuth, async (req, res) => {
  try {
    // adminAuth already checks is_admin
    const { course_id, mp4_key } = req.body;
    if (!course_id || !mp4_key) {
      return res.status(400).json({ code: 40000, message: '缺少 course_id 或 mp4_key' });
    }

    const courseId = parseInt(course_id);
    const [courses] = await db.query('SELECT id FROM courses WHERE id = ? LIMIT 1', [courseId]);
    if (!courses || (Array.isArray(courses) && !courses.length)) {
      return res.status(404).json({ code: 40400, message: '课程不存在' });
    }

    // 回调地址（依赖 api.hhlfedu.com DNS 生效）
    const callbackUrl = `https://api.hhlfedu.com/api/v1/video/notify`;

    // 1. 触发 PFOP 转码
    let persistentId;
    if (videoService.isConfigured()) {
      const result = await videoService.triggerPfop(courseId, mp4_key, callbackUrl);
      persistentId = result.persistentId;

      // 2. 存 Redis 映射：persistentId → { courseId, mp4_key }（7天过期）
      const redis = getRedis();
      await redis.set(
        `video_pfop:${persistentId}`,
        JSON.stringify({ courseId, mp4_key }),
        'EX', 7 * 86400
      );
    }

    // 3. 更新课程状态为"转码中"
    await db.execute(
      'UPDATE courses SET video_key = ?, video_status = ?, updated_at = NOW() WHERE id = ?',
      [mp4_key, 'transcoding', courseId]
    );

    res.json({
      code: 0,
      data: { status: 'transcoding', persistent_id: persistentId || null },
      message: '转码已触发',
    });
  } catch (err) {
    console.error('[video/uploaded]', err.message);
    res.status(500).json({ code: 50000, message: err.message || '触发转码失败' });
  }
});

// ==================== 查询转码状态 ====================
// GET /api/video/status/:courseId
// 前端轮询此接口查询转码进度
router.get('/status/:courseId', async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    if (!courseId) {
      return res.status(400).json({ code: 40000, message: '缺少 courseId' });
    }

    const [courses] = await db.query(
      'SELECT id, video_key, video_url, video_status FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );
    // courses 可能是 RowDataPacket 对象（单个）或 RowDataPacket[] 数组（批量）
    if (!courses || (Array.isArray(courses) && !courses.length)) {
      return res.status(404).json({ code: 40400, message: '课程不存在' });
    }

    const course = Array.isArray(courses) ? courses[0] : courses;
    res.json({
      code: 0,
      data: {
        status: course.video_status || 'none',
        video_url: course.video_url || null,
        video_key: course.video_key || null,
      },
      message: '成功',
    });
  } catch (err) {
    console.error('[video/status]', err.message);
    res.status(500).json({ code: 50000, message: '查询失败' });
  }
});

// ==================== 私有播放签名URL ====================
// GET /api/video/play-url/:key
// 播放端通过此接口获取带签名的视频URL（前端的video组件用签名URL）
// 支持 HLS (.m3u8)：自动拉取 m3u8 内容，重写所有 .ts 分片 URL 为签名 URL
router.get('/play-url/:key(*)', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!key) {
      return res.status(400).json({ code: 40000, message: '缺少视频key' });
    }

    if (!videoService.isConfigured()) {
      // 未配置七牛时，直接返回原始URL（用于本地测试）
      return res.json({ code: 0, data: { url: key, signed: false }, message: '成功' });
    }

    // HLS 播放列表：返回原始 m3u8 文本（供 video 组件直接播放）
    // video 组件识别 .m3u8 后自动以 HLS 方式拉取所有 .ts 分片
    if (key.endsWith('.m3u8')) {
      const { signedM3u8, contentType } = await videoService.getSignedHlsPlaylist(key);
      res.set({
        'Content-Type': contentType || 'application/vnd.apple.mpegurl',
        'Cache-Control': 'private, max-age=3500',
        'X-Qiniu-Signed': 'true',
      });
      return res.type(contentType || 'application/vnd.apple.mpegurl').send(signedM3u8);
    }

    // 普通视频文件：直接返回签名 URL
    const signedUrl = videoService.createSignedUrlSync(key);
    res.json({ code: 0, data: { url: signedUrl, signed: true }, message: '成功' });
  } catch (err) {
    console.error('[video/play-url]', err.message);
    res.status(500).json({ code: 50000, message: '生成播放链接失败' });
  }
});

// GET /api/video/cdn-url/:key
// 返回图片/视频的完整CDN地址（私有bucket需要签名URL）
router.get('/cdn-url/:key(*)', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!key) {
      return res.status(400).json({ code: 40000, message: '缺少key' });
    }
    // 私有bucket必须用签名URL，否则返回403
    const url = videoService.createSignedUrlSync(key);
    res.json({ code: 0, data: url, message: '成功' });
  } catch (err) {
    console.error('[video/cdn-url]', err.message);
    res.status(500).json({ code: 50000, message: '获取CDN地址失败' });
  }
});

// ==================== 转码完成回调 ====================
// POST /api/video/notify
// 七牛云视频转码完成后回调此接口，更新课程视频地址
// 鉴权：X-Qiniu-Signature = HMAC-SHA1(callbackSecret, rawBody)
// 幂等防护：基于 persistentId 缓存去重，重复回调返回成功不重复处理
router.post('/notify', async (req, res) => {
  try {
    // 1. HMAC 签名验证（基于回调 body）
    const callbackSecret = config.qiniu?.callbackSecret;
    if (callbackSecret) {
      const sig = req.get('X-Qiniu-Signature');
      if (!sig) {
        return res.status(401).json({ code: 40100, message: '缺少回调签名' });
      }
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expected = crypto
        .createHmac('sha1', callbackSecret)
        .update(body, 'utf8')
        .digest('hex');
      if (sig !== expected) {
        return res.status(403).json({ code: 40300, message: '回调签名验证失败' });
      }
    }

    // 解析七牛回调 body（可能为 object 或 string）
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const events = body.events;
    const items = body.items;

    // 验证是否是转码完成事件（兼容中英文事件名）
    const isTranscoded = events && (
      (Array.isArray(events) && events.some(e => typeof e === 'string' && (
        e.includes('TranscodeFinished') || e.includes('fop_done') || e.includes('workflow_finished') || e.includes('转码完成')
      ))) ||
      (typeof events === 'string' && (
        events.includes('TranscodeFinished') || events.includes('fop_done') || events.includes('workflow_finished') || events.includes('转码完成')
      ))
    );
    if (!isTranscoded) {
      console.log('[video/notify] 忽略非转码事件, events=', JSON.stringify(events).substring(0, 200));
      return res.json({ code: 0, data: null, message: '忽略非转码事件' });
    }

    if (!items || items.length === 0) {
      return res.json({ code: 0, data: null, message: '无处理项目' });
    }

    // 2. 幂等防护 + 从 Redis 取 courseId 映射
    console.log('[video/notify] 开始处理, items count:', items ? items.length : 0);
    const redis = getRedis();
    console.log('[video/notify] Redis连接成功');
    const results = [];
    for (const item of items) {
      const { code, description, key, persistentId } = item;

      if (code !== 0) {
        console.error('[video/notify] 转码失败:', description);
        // 转码失败，更新状态
        if (persistentId) {
          const mappingStr = await redis.get(`video_pfop:${persistentId}`);
          if (mappingStr) {
            const { courseId } = JSON.parse(mappingStr);
            await db.execute(
              'UPDATE courses SET video_status = ?, updated_at = NOW() WHERE id = ?',
              ['failed', courseId]
            );
          }
        }
        results.push({ key, success: false, error: description });
        continue;
      }

      // 幂等检查
      if (persistentId) {
        const idempotentKey = `video_notify:${persistentId}`;
        const already = await redis.get(idempotentKey);
        if (already) {
          console.log(`[video/notify] 重复回调忽略 persistentId=${persistentId}`);
          results.push({ key, success: true, duplicate: true });
          continue;
        }
        await redis.set(idempotentKey, '1', 'EX', 86400);
      }

      // 从 Redis 取 courseId（由 /uploaded 接口写入）
      let courseId = null;
      if (persistentId) {
        const mappingStr = await redis.get(`video_pfop:${persistentId}`);
        if (mappingStr && mappingStr !== 'null') {
          try {
            const mapping = JSON.parse(mappingStr);
            courseId = mapping?.courseId ?? null;
          } catch {
            courseId = null;
          }
          // 清理映射
          await redis.del(`video_pfop:${persistentId}`);
        }
      }

      // 兜底：从 key 匹配 course_id（m3u8 key 格式不固定，跳过此方式）
      if (!courseId) {
        console.error('[video/notify] 无法获取 courseId，Redis 无映射 persistentId=', persistentId);
        results.push({ key, success: false, error: 'courseId未找到' });
        continue;
      }

      // 校验课程存在性
      const [courses] = await db.query('SELECT id FROM courses WHERE id = ?', [courseId]);
      const course = Array.isArray(courses) ? courses[0] : courses;
      if (!course) {
        console.error('[video/notify] 课程不存在:', courseId);
        results.push({ key, success: false, error: '课程不存在' });
        continue;
      }

      // 更新数据库：video_url 存 m3u8 key，状态设为已就绪
      await db.execute(
        'UPDATE courses SET video_url = ?, video_status = ?, updated_at = NOW() WHERE id = ?',
        [key, 'ready', courseId]
      );

      results.push({ courseId, key, success: true });
      console.log(`[video/notify] 课程 ${courseId} 视频就绪: ${key}`);
    }

    res.json({ code: 0, data: results, message: '成功' });
  } catch (err) {
    console.error('[video/notify]', err.stack || err.message || err);
    res.status(500).json({ code: 50000, message: '处理回调失败' });
  }
});

// ==================== 删除视频（管理员） ====================
// DELETE /api/video/:key
router.delete('/:key(*)', auth, async (req, res) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ code: 40300, message: '需要管理员权限' });
    }
    const key = decodeURIComponent(req.params.key);
    const result = await videoService.deleteFile(key);
    await db.execute(
      'UPDATE courses SET video_key = NULL, video_url = NULL, video_status = ?, updated_at = NOW() WHERE video_key = ? OR video_url = ?',
      ['none', key, key]
    );
    res.json({ code: 0, data: result, message: '删除完成' });
  } catch (err) {
    console.error('[video/delete]', err.message);
    res.status(500).json({ code: 50000, message: '删除失败' });
  }
});

module.exports = router;
