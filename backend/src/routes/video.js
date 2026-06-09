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
const Course = require('../models/Course');

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
      //    Redis 写入失败时需回退：查刚插入的 course_videos 记录，拿到自增 id 用于后续 notify 匹配
      const redis = getRedis();
      try {
        await redis.set(
          `video_pfop:${persistentId}`,
          JSON.stringify({ courseId, mp4_key }),
          'EX', 7 * 86400
        );
      } catch (redisErr) {
        console.error('[video/uploaded] Redis set 失败，回退到 DB 查询:', redisErr.message);
        // Redis 写入失败时：从 course_videos 表按 (course_id + video_key) 查自增 id
        // notify handler 会用 (course_id + video_key) 匹配，这里保证 Redis 有映射即可
        // 实际上 notify 端也做了 course_videos 回查兜底，所以这里只打日志不影响主流程
      }
    }

    // 3. 更新课程状态为"转码中"
    await db.execute(
      'UPDATE courses SET video_key = ?, video_status = ?, updated_at = NOW() WHERE id = ?',
      [mp4_key, 1, courseId]
    );

    // 4. 写入 course_videos 记录（支持多视频）
    //    video_status=1 表示"转码中"，notify 回调成功后会更新为 2
    await db.execute(
      'INSERT INTO course_videos (course_id, video_key, video_status, sort) VALUES (?,?,1, (SELECT COALESCE(MAX(sort),0)+1 FROM (SELECT MAX(sort) as sort FROM course_videos WHERE course_id=?) AS t))',
      [courseId, mp4_key, courseId]
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
// GET /api/video/status/:courseId?video_key=xxx
// 前端轮询此接口查询转码进度
router.get('/status/:courseId', async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    if (!courseId) {
      return res.status(400).json({ code: 40000, message: '缺少 courseId' });
    }

    // 如果前端传了 video_key，说明是多视频场景，查询 course_videos 表
    const { video_key } = req.query;
    if (video_key) {
      const rows = await db.query(
        'SELECT id, video_key, video_url, video_status FROM course_videos WHERE course_id = ? AND video_key = ? LIMIT 1',
        [courseId, decodeURIComponent(video_key)]
      );
      const video = Array.isArray(rows) ? rows[0] : rows;
      if (!video) {
        // 视频记录还没创建，继续轮询（转码触发后需要几秒才写入DB）
        return res.json({ code: 0, data: { status: 'pending', video_url: null, video_key: null }, message: '成功' });
      }
      return res.json({
        code: 0,
        data: {
          status: video.video_status,
          video_url: video.video_url || null,
          video_key: video.video_key || null,
        },
        message: '成功',
      });
    }

    // 旧版单视频逻辑（兼容）
    const [courses] = await db.query(
      'SELECT id, video_key, video_url, video_status FROM courses WHERE id = ? LIMIT 1',
      [courseId]
    );
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

// ==================== HLS m3u8 代理（相对路径方案） ====================
// GET /api/video/hls-play-url/:key
// 返回 m3u8 内容，.ts 分片路径为相对路径（如 KhhO.../xxx/000000.ts）
// 播放器请求这些相对路径时，请求同源 /api/video/ts/:key，由后端流式转发到七牛
// 解决微信 video 组件对带 token 的绝对 URL 解析错误导致的双重域名前缀问题
router.get('/hls-play-url/:key(*)', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!key) {
      return res.status(400).json({ code: 40000, message: '缺少视频key' });
    }

    // 未配置七牛时，直接返回原始 key（用于本地测试）
    if (!videoService.isConfigured()) {
      return res.json({ code: 0, data: { url: key, signed: false }, message: '成功' });
    }

    // .ts 分片请求：直接代理到七牛（播放器请求相对路径时，base URL 为当前接口）
    // 注意：m3u8 中 = 替换为 _，/ 替换为 |，这里要反向替换
    // 解码顺序：先 | → /（还原目录分隔符），再 _ → =（还原 token 中的 =）
    if (key.endsWith('.ts')) {
      const realKey = ('videos/' + key).replace(/\|/g, '/').replace(/_(?=\/)/g, '=');
      const signedUrl = videoService.createSignedUrlSync(realKey);
      try {
        const response = await fetch(signedUrl);
        res.set('Content-Type', 'video/mp2t');
        res.set('Cache-Control', 'no-cache, no-store');
        res.set('Access-Control-Allow-Origin', '*');
        Readable.fromWeb(response.body).pipe(res);
      } catch (err) {
        console.error('[video/hls-play-url .ts]', err.message);
        res.status(500).json({ code: 50000, message: '获取视频分片失败' });
      }
      return;
    }

    // 使用 relative 模式：.ts 路径转为相对路径
    const { signedM3u8, contentType } = await videoService.getSignedHlsPlaylist(key, 'relative');
    res.set({
      'Content-Type': contentType || 'application/vnd.apple.mpegurl',
      'Cache-Control': 'private, max-age=600',
    });
    return res.type(contentType || 'application/vnd.apple.mpegurl').send(signedM3u8);
  } catch (err) {
    console.error('[video/hls-play-url]', err.message);
    res.status(500).json({ code: 50000, message: '生成播放链接失败' });
  }
});

// ==================== 私有播放签名URL ====================
// GET /api/video/play-url/:key
// 播放端通过此接口获取带签名的视频URL（前端的video组件用签名URL）
// 支持 HLS (.m3u8)：自动拉取 m3u8 内容，重写所有 .ts 分片 URL 为签名 URL
// 权限：需登录，且课程为免费/已购买/管理员
router.get('/play-url/:key(*)', auth, async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!key) {
      return res.status(400).json({ code: 40000, message: '缺少视频key' });
    }

    // 权限校验：从 video key 反推 courseId，校验用户是否有权观看
    // key 格式：videos/course_{id}.m3u8 或 videos/course_{id}.mp4
    const courseIdMatch = key.match(/course_(\d+)/);
    if (courseIdMatch) {
      const courseId = parseInt(courseIdMatch[1]);
      const [courseRows, orderRows] = await Promise.all([
        db.query('SELECT id, is_free FROM courses WHERE id = ?', [courseId]),
        db.query(
          'SELECT id FROM orders WHERE user_id = ? AND course_id = ? AND status IN (1,2,3) LIMIT 1',
          [req.user.id, courseId]
        ),
      ]);
      if (courseRows.length === 0) {
        return res.status(404).json({ code: 40400, message: '课程不存在' });
      }
      const course = courseRows[0];
      const isBought = orderRows.length > 0;
      const isAdmin = req.user.is_admin;
      // 已购/免费/管理员直接通过；登录未购买用户也可获取签名URL（前端控制试看）
    }

    if (!videoService.isConfigured()) {
      // 未配置七牛时，直接返回原始URL（用于本地测试）
      return res.json({ code: 0, data: { url: key, signed: false }, message: '成功' });
    }

    // HLS 播放列表：返回相对路径 m3u8（避免微信 video 组件绝对 URL 解析 bug）
    // video 组件识别 .m3u8 后，.ts 分片以相对路径请求，由 /hls-play-url/:key(*).ts 路由代理
    if (key.endsWith('.m3u8')) {
      const { signedM3u8, contentType } = await videoService.getSignedHlsPlaylist(key, 'relative');
      res.set({
        'Content-Type': contentType || 'application/vnd.apple.mpegurl',
        'Cache-Control': 'private, max-age=600', // 与内部 m3u8 缓存 TTL 对齐（10分钟）
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

// ==================== 试看视频（20秒，无需登录）====================
// GET /api/video/trial-url/:key
// 返回带 20 秒签名的 m3u8 播放地址，支持未登录/未购买用户试看
router.get('/trial-url/:key(*)', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!key) {
      return res.status(400).json({ code: 40000, message: '缺少视频key' });
    }

    // 未配置七牛时，直接返回原始URL（用于本地测试）
    if (!videoService.isConfigured()) {
      return res.json({ code: 0, data: { url: key, signed: false, trial: true }, message: '成功' });
    }

    // 20 秒有效期签名
    const TRIAL_EXPIRE = 20;
    if (key.endsWith('.m3u8')) {
      const { signedM3u8, contentType } = await videoService.getSignedHlsPlaylist(key, 'relative', TRIAL_EXPIRE);
      res.set({
        'Content-Type': contentType || 'application/vnd.apple.mpegurl',
        'Cache-Control': 'private, max-age=20',
        'X-Trial': 'true',
      });
      return res.type(contentType || 'application/vnd.apple.mpegurl').send(signedM3u8);
    }

    // 普通视频文件：返回 20 秒签名的 URL
    const signedUrl = videoService.createSignedUrlSync(key, TRIAL_EXPIRE);
    res.json({ code: 0, data: { url: signedUrl, signed: true, trial: true }, message: '成功' });
  } catch (err) {
    console.error('[video/trial-url]', err.message);
    res.status(500).json({ code: 50000, message: '生成试看链接失败' });
  }
});

// ==================== 图片代理（后端拉取再转发） ====================
// GET /api/video/image-proxy/:key
// 私有 bucket 无法直接给前端签名 URL，改走后端代理拉取再转发（参考 .ts 分片代理模式）
router.get('/image-proxy/:key(*)', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!key) {
      return res.status(400).json({ code: 40000, message: '缺少key' });
    }

    const { data, contentType } = await videoService.fetchImage(key);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // 图片缓存 1 天
    res.set('Access-Control-Allow-Origin', '*');
    res.send(data);
  } catch (err) {
    console.error('[video/image-proxy]', err.message);
    res.status(500).json({ code: 50000, message: '获取图片失败' });
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

// ==================== HLS .ts 分片代理 ====================
// GET /api/video/ts/*
// 播放器请求 .ts 分片时走此代理接口
// 后端实时生成新签名并转发到七牛，解决 m3u8 缓存后签名过期的问题
// 注意：m3u8 中 .ts 路径的 = 已替换为 _，/ 替换为 |（避免 Express 路由截断）
router.get(/\/ts\/(.*)/, async (req, res) => {
  try {
    // req.params[0] 捕获 /ts/ 之后的所有路径
    // m3u8 编码规则：videos/ 前缀去掉，= → _，/ → |
    // 编码顺序：= → _（先），/ → |（后）
    // 解码顺序：必须反过来 —— 先 | → /（还原目录分隔符），再 _ → =（还原所有 =）
    // 注意：编码时 replace(/=/g, '_') 替换了所有 =，包括文件名末尾原本的 =
    //       所以解码时必须用 /_/g 还原所有 _，不能用 /_(?=\/)/（那样只能还原路径分隔符前的 _）
    const raw = req.params[0]; // 不用 decodeURIComponent，因为 | 是合法路径字符不会编码
    const key = raw.replace(/\|/g, '/').replace(/_/g, '=');
    if (!key) {
      return res.status(400).json({ code: 40000, message: '缺少ts路径' });
    }

    // 私有bucket必须用签名URL，否则返回403
    const signedUrl = videoService.createSignedUrlSync(key);

    // 代理请求到七牛，StreamingResponse
    let response = await fetch(signedUrl);
    if (!response.ok) {
      // 如果404，尝试备用路径修正（某些转码服务输出的m3u8中ts路径前缀与实际bucket key不匹配）
      // 典型错误：m3u8中 =MwY2P2... 但bucket中实际是 _MwY2P2...
      // 当主key 404时，尝试把第一个 = 替换回 _（即还原编码时的错误替换）
      const altKey = key.replace(/=/, '_');
      if (altKey !== key) {
        const altUrl = videoService.createSignedUrlSync(altKey);
        response = await fetch(altUrl);
        if (response.ok) {
          // 用备用key成功，转发响应
          res.set('Content-Type', 'video/mp2t');
          res.set('Cache-Control', 'no-cache, no-store');
          res.set('Access-Control-Allow-Origin', '*');
          Readable.fromWeb(response.body).pipe(res);
          return;
        }
      }
      console.error('[video/ts] 七牛请求失败:', response.status, key);
      return res.status(response.status).json({ code: response.status, message: '获取视频分片失败' });
    }

    // 将七牛的响应流式转发给播放器（fromWeb 转换 Web Stream → Node Stream）
    res.set('Content-Type', 'video/mp2t');
    res.set('Cache-Control', 'no-cache, no-store');
    res.set('Access-Control-Allow-Origin', '*');
    Readable.fromWeb(response.body).pipe(res);
  } catch (err) {
    console.error('[video/ts]', err.message);
    res.status(500).json({ code: 50000, message: '获取视频分片失败' });
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

    // PFOP 转码回调 body 结构：
    // { id: persistentId, code: 0, items: [{ code, key, description, persistentId }] }
    // items[].code === 0 表示转码成功
    const items = body.items;
    const pfopCode = body.code;

    // 判断转码成功：PFOP 回调中 code=0 表示整个任务成功
    // 或者 items 里每个 item.code === 0
    const isTranscoded = (pfopCode === 0) || (Array.isArray(items) && items.length > 0 && items.some(i => i.code === 0));

    if (!isTranscoded) {
      const codeStr = pfopCode === undefined ? 'undefined' : String(pfopCode);
      const itemsStr = items === undefined ? 'undefined' : JSON.stringify(items).substring(0, 200);
      console.log('[video/notify] 非转码成功事件, pfopCode=', codeStr, 'items=', itemsStr);
      return res.json({ code: 0, data: null, message: '非转码成功事件' });
    }

    if (!items || items.length === 0) {
      return res.json({ code: 0, data: null, message: '无处理项目' });
    }

    // 2. 幂等防护 + 从 Redis 取 courseId 映射
    const redis = getRedis();
    console.log('[video/notify] Redis连接成功, body.id:', body.id);
    try {
      const mappingStr = await redis.get(`video_pfop:${body.id}`);
      console.log('[video/notify] Redis mappingStr:', mappingStr);
    } catch (redisErr) {
      console.error('[video/notify] Redis get错误:', redisErr.message);
    }
    // PFOP 回调：persistentId 在 body.id，不在 item.persistentId
    const pfopPersistentId = body.id;
    const results = [];
    for (const item of items) {
      const { code, description, key } = item;

      if (code !== 0) {
        console.error('[video/notify] 转码失败:', description);
        results.push({ key, success: false, error: description });
        continue;
      }

      // 幂等检查（用 body.id 作为 persistentId）
      if (pfopPersistentId) {
        const idempotentKey = `video_notify:${pfopPersistentId}`;
        const already = await redis.get(idempotentKey);
        if (already) {
          console.log(`[video/notify] 重复回调忽略 persistentId=${pfopPersistentId}`);
          results.push({ key, success: true, duplicate: true });
          continue;
        }
        await redis.set(idempotentKey, '1', 'EX', 86400);
      }

      // 从 Redis 取 courseId 和 mp4_key（由 /uploaded 接口写入，key = video_pfop:persistentId）
      let courseId = null;
      let storedMp4Key = null;
      if (pfopPersistentId) {
        const mappingStr = await redis.get(`video_pfop:${pfopPersistentId}`);
        if (mappingStr && mappingStr !== 'null') {
          try {
            const mapping = JSON.parse(mappingStr);
            courseId = mapping?.courseId ?? null;
            storedMp4Key = mapping?.mp4_key ?? null;
          } catch {
            courseId = null;
          }
          // 清理映射
          await redis.del(`video_pfop:${pfopPersistentId}`);
        }
      }

      // 兜底：从 key 匹配 course_id（m3u8 key 格式不固定，跳过此方式）
      if (!courseId) {
        console.error('[video/notify] 无法获取 courseId，Redis 无映射 persistentId=', pfopPersistentId);
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
      // 同时更新 course_videos 记录和多视频关联的 courses 表
      // 优先用 storedMp4Key 匹配；Redis 失效时用 (course_id + key) 查 course_videos 兜底
      let updateSuccess = false;
      if (storedMp4Key) {
        const r1 = await db.execute(
          'UPDATE course_videos SET video_url = ?, video_status = 2, updated_at = NOW() WHERE course_id = ? AND video_key = ?',
          [key, courseId, storedMp4Key]
        );
        updateSuccess = (r1?.affectedRows ?? 0) > 0;
      }
      if (!updateSuccess) {
        // Redis 映射丢失：用 course_id + m3u8 key 查 course_videos 回填（m3u8 key 即 outputKey）
        const [rows] = await db.query(
          'SELECT id FROM course_videos WHERE course_id = ? AND (video_key = ? OR video_url = ?) LIMIT 1',
          [courseId, key, key]
        );
        const rec = Array.isArray(rows) ? rows[0] : rows;
        if (rec) {
          await db.execute(
            'UPDATE course_videos SET video_url = ?, video_status = 2, updated_at = NOW() WHERE id = ?',
            [key, rec.id]
          );
          updateSuccess = true;
        }
      }
      await db.execute(
        'UPDATE courses SET video_url = ?, video_status = ?, updated_at = NOW() WHERE id = ?',
        [key, 2, courseId]
      );

      results.push({ courseId, key, success: updateSuccess });
      console.log(`[video/notify] 课程 ${courseId} 视频就绪: ${key}，course_videos更新=${updateSuccess}`);
    }

    res.json({ code: 0, data: results, message: '成功' });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : '';
    console.error('[video/notify] 异常:', errMsg, '\n', errStack.substring(0, 500));
    try {
      res.status(500).json({ code: 50000, message: '处理回调失败: ' + errMsg });
    } catch (jsonErr) {
      console.error('[video/notify] json写入失败:', jsonErr.message);
      res.status(500).end();
    }
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
      [0, key, key]
    );
    res.json({ code: 0, data: result, message: '删除完成' });
  } catch (err) {
    console.error('[video/delete]', err.message);
    res.status(500).json({ code: 50000, message: '删除失败' });
  }
});

module.exports = router;
