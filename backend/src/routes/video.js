/**
 * 七牛云 VOD 路由
 *
 * POST /api/video/upload-token  — 管理员请求上传凭证
 * GET  /api/video/play-url/:key — 获取私有bucket签名播放URL
 * POST /api/video/notify        — 七牛转码完成回调（无需登录）
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const videoService = require('../services/video');
const db = require('../config/database');

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

    // 生成图片key
    const key = videoService.generateImageKey(course_id, filename);
    const { token, key: returnedKey, expires } = videoService.createImageUploadToken(key);

    res.json({ code: 0, data: { token, key: returnedKey, expires }, message: '成功' });
  } catch (err) {
    console.error('[video/image-token]', err.message);
    res.status(500).json({ code: 50000, message: err.message || '获取上传凭证失败' });
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
router.post('/notify', async (req, res) => {
  try {
    const { pipeline, events, items } = req.body;

    // 验证是否是转码完成事件（兼容中英文事件名）
    // 七牛云事件名：TranscodeFinished / fop_done / workflow_finished
    const isTranscoded = events && (
      events.includes('TranscodeFinished') ||
      events.includes('fop_done') ||
      events.includes('workflow_finished') ||
      events.includes('转码完成')
    );
    if (!isTranscoded) {
      // 可能是其他事件，直接返回成功
      return res.json({ code: 0, data: null, message: '忽略非转码事件' });
    }

    if (!items || items.length === 0) {
      return res.json({ code: 0, data: null, message: '无处理项目' });
    }

    // 遍历处理每个转码完成的项目
    const results = [];
    for (const item of items) {
      const { code, description, hash, key, fsize, mimeType } = item;

      if (code !== 0) {
        console.error('[video/notify] 转码失败:', description);
        results.push({ key, success: false, error: description });
        continue;
      }

      // 从key提取course_id（格式：videos/course_{id}_xxx.m3u8）
      const match = key.match(/videos\/course_(\d+)_\d+\.m3u8$/);
      if (!match) {
        console.error('[video/notify] 无法解析course_id from key:', key);
        results.push({ key, success: false, error: 'key格式不匹配' });
        continue;
      }

      const courseId = parseInt(match[1]);

      // 更新数据库：video_url 存原始m3u8的key（不含域名）
      await db.execute(
        'UPDATE courses SET video_url = ?, updated_at = NOW() WHERE id = ?',
        [key, courseId]
      );

      results.push({ courseId, key, success: true });
      console.log(`[video/notify] 课程 ${courseId} 视频更新: ${key}`);
    }

    res.json({ code: 0, data: results, message: '成功' });
  } catch (err) {
    console.error('[video/notify]', err);
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

    res.json({ code: 0, data: result, message: '删除完成' });
  } catch (err) {
    console.error('[video/delete]', err.message);
    res.status(500).json({ code: 50000, message: '删除失败' });
  }
});

module.exports = router;
