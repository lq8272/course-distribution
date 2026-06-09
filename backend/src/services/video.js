/**
 * 七牛云 VOD 视频服务
 *
 * 功能：
 * 1. 生成上传凭证（服务端签名）
 * 2. 生成私有bucket访问签名URL（防盗播放）
 * 3. 处理转码完成回调
 *
 * 接入流程：
 * 1. 后端配置 AK/SK/空间名/域名
 * 2. 前端请求 /api/video/upload-token 获得上传凭证
 * 3. 前端用凭证直传七牛（不上传到后端，省带宽）
 * 4. 七牛转码完成后回调 /api/video/notify
 * 5. 播放时后端生成签名URL，前端用签名URL播放
 */

const qiniu = require('qiniu');
const crypto = require('crypto');

// ==================== m3u8 签名缓存（10分钟TTL）====================
const m3u8Cache = new Map();
const M3U8_CACHE_TTL = 600 * 1000; // 10分钟

function getCachedM3u8(key) {
  const entry = m3u8Cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > M3U8_CACHE_TTL) {
    m3u8Cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedM3u8(key, data) {
  m3u8Cache.set(key, { data, ts: Date.now() });
}

// ==================== 配置 ====================
// 七牛云账号 → https://portal.qiniu.com/user/key
const ACCESS_KEY = process.env.QINIU_ACCESS_KEY || '';
const SECRET_KEY = process.env.QINIU_SECRET_KEY || '';
// 存储空间名（图片和视频分开）
const BUCKET_IMAGE = process.env.QINIU_BUCKET_IMAGE || '';
const BUCKET_VIDEO = process.env.QINIU_BUCKET_VIDEO || '';
// 公开域名前缀（图片 bucket 的 CDN 域名）
const PUBLIC_DOMAIN = process.env.QINIU_PUBLIC_DOMAIN || '';
// 图片 bucket CDN 域名（私有 bucket，用 privateDownloadUrl 生成下载凭证）
const PICTURE_DOMAIN = process.env.QINIU_PICTURE_DOMAIN || PUBLIC_DOMAIN || 'pictures.hhlfedu.com';
// 视频 bucket 域名（私有 bucket 签名用，用于视频播放）
const VIDEO_DOMAIN = process.env.QINIU_VIDEO_DOMAIN || PUBLIC_DOMAIN || 'videos.hhlfedu.com';
// 七牛上传域名（按 zone 动态构造）
const UPLOAD_HOST_MAP = {
  z0: 'https://up-z0.qiniup.com',
  z1: 'https://up-z1.qiniup.com',
  z2: 'https://up-z2.qiniup.com',
  na0: 'https://up-na0.qiniup.com',
};
const getUploadHost = () => UPLOAD_HOST_MAP[BUCKET_ZONE] || UPLOAD_HOST_MAP.z2;
// 私有bucket签名URL有效期（秒），默认24小时（直连七牛方案用）
const SIGNED_URL_EXPIRE = parseInt(process.env.QINIU_URL_EXPIRE || '86400');
// CDN 时间戳防盗链密钥（七牛 CDN 控制台获取）
const CDN_TIMESTAMP_KEY = process.env.QINIU_CDN_TIMESTAMP_KEY || '';
// 七牛 bucket 区域（影响 API 请求节点）：
// z0=华东, z1=华北, z2=华南, na0=北美
const BUCKET_ZONE = process.env.QINIU_ZONE || 'z0';
const ZONE_MAP = {
  z0: qiniu.zone.Zone_z0,
  z1: qiniu.zone.Zone_z1,
  z2: qiniu.zone.Zone_z2,
  na0: qiniu.zone.Zone_na0,
};
const getZone = () => ZONE_MAP[BUCKET_ZONE] || qiniu.zone.Zone_z0;
// Bucket 源站域名（用于 RS API / privateDownloadUrl，不能用 CDN 域名）
const zoneSuffix = BUCKET_ZONE.replace('z', '');
const getVideoBucketDomain = () => BUCKET_VIDEO + '.z' + zoneSuffix + '.qiniup.com';
const getImageBucketDomain = () => BUCKET_IMAGE + '.z' + zoneSuffix + '.qiniup.com';

// 是否已配置（未配置时返回友好提示）
const isConfigured = () => !!(ACCESS_KEY && SECRET_KEY && BUCKET_IMAGE && BUCKET_VIDEO);

// ==================== 私有bucket签名（QBox Token）====================
/**
 * 生成私有bucket资源的访问签名URL（QBox Token）
 * 所有图片和视频下载统一使用此方式
 *
 * @param {string} key - 七牛存储key，如 images/xxx.jpg 或 videos/xxx.mp4
 * @param {string} domain - CDN域名，如 pictures.hhlfedu.com 或 videos.hhlfedu.com
 * @param {number} expires - 签名有效期（秒），默认 SIGNED_URL_EXPIRE
 * @returns {string} 带签名的下载URL
 */
function createQboxSignedUrl(key, domain, expires = SIGNED_URL_EXPIRE) {
  const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
  const config = new qiniu.conf.Config();
  config.zone = getZone();
  const bucketManager = new qiniu.rs.BucketManager(mac, config);
  const deadline = Math.floor(Date.now() / 1000) + expires;
  // 必须传完整 URL（带 https://），privateDownloadUrl 内部会正确处理
  return bucketManager.privateDownloadUrl(domain, key, deadline);
}

/**
 * 为 HLS 播放列表签名
 *
 * mode = 'signed'（默认）：.ts 路径替换为带签名的完整 URL，播放器直连七牛
 * mode = 'relative'：.ts 路径替换为相对路径（如 ts/KhhO.../xxx/000000.ts），
 *                   播放器请求同源 /ts/:key 路由，由后端流式转发到七牛
 *
 * @param {string} hlsContent - 原始 m3u8 文本
 * @param {'signed'|'relative'} mode - 路径替换模式
 * @returns {string} 处理后的 m3u8 文本
 */
function signHlsContent(hlsContent, mode = 'signed') {
  const domainForStrip = VIDEO_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // 正则匹配 .ts/.key 路径：
  // - 有目录的路径如 videos/seg0.ts  -> 匹配前面的目录+文件名
  // - 裸文件名如 seg0.ts            -> 匹配整个文件名
  // - 带域名的如 https://domain.com/seg0.ts -> 匹配到 .ts 为止
  const TS_PATTERN = /^(.+?\.(?:ts|key)|\??\.?(?:ts|key))(.*)$/gm;

  return hlsContent.replace(TS_PATTERN, (match, tsPath) => {
    // 取干净路径，去掉 query string
    let cleanPath = tsPath.split('?')[0];

    // 去掉域名部分（支持 https://domain.com/ 和 domain.com/ 两种形式）
    if (cleanPath.includes(domainForStrip)) {
      cleanPath = cleanPath.substring(cleanPath.indexOf(domainForStrip) + domainForStrip.length);
    }
    // 去掉开头的 /
    cleanPath = cleanPath.replace(/^\/+/, '');

    if (mode === 'relative') {
      // 关键：必须加 /ts/ 前缀，否则播放器会把 ts 分片请求发到 m3u8 所在路径（/hls-play-url/），
      //       而不是 /ts/ 路由
      const decoded = cleanPath.replace(/^\.?\/?videos\//, '').replace(/=/g, '_').replace(/\|/g, '/');
      return '/ts/' + decoded.replace(/=/g, '_').replace(/\//g, '|');
    }

    // 默认 signed 模式：返回带签名的完整 URL（播放器直连 CDN）
    const signedUrl = createQboxSignedUrl(cleanPath, VIDEO_DOMAIN);
    return signedUrl;
  });
}

/**
 * 生成图片上传凭证
 * @param {string} key - 文件存储key
 * @returns {object} { token, key, expires }
 */
function createImageUploadToken(key) {
  if (!isConfigured()) {
    throw new Error('七牛云未配置，请设置环境变量 QINIU_ACCESS_KEY / QINIU_SECRET_KEY / QINIU_BUCKET_IMAGE');
  }
  const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
  const deadline = Math.floor(Date.now() / 1000) + 7200;
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: BUCKET_IMAGE + ':' + key,
    deadline,
    insertOnly: 1,
    fsizeLimit: 10 * 1024 * 1024, // 10MB
    mimeLimit: 'image/jpeg;image/png;image/gif;image/webp',
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize)}',
  });
  return {
    token: putPolicy.uploadToken(mac),
    key,
    expires: 7200,
    uploadHost: getUploadHost(),
  };
}

// ==================== 上传凭证（视频）=================
/**
 * 生成视频上传凭证
 * 前端凭此凭证直传文件到七牛（不经过后端）
 *
 * @param {string} key - 文件存储key，如 'videos/course_1_20260422.mp4'
 * @returns {object} { token, key, expires }
 */
function createUploadToken(key) {
  if (!isConfigured()) {
    throw new Error('七牛云未配置，请设置环境变量 QINIU_ACCESS_KEY / QINIU_SECRET_KEY / QINIU_BUCKET_VIDEO');
  }
  const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
  const deadline = Math.floor(Date.now() / 1000) + 7200;
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: BUCKET_VIDEO + ':' + key,
    deadline,
    insertOnly: 1,
    fsizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
    mimeLimit: 'video/mp4;video/quicktime;video/x-msvideo;video/x-matroska;video/webm',
    returnBody: '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"persistentId":"$(persistentId)"}',
  });
  return {
    token: putPolicy.uploadToken(mac),
    key,
    expires: 7200,
    uploadHost: getUploadHost(),
  };
}

// ==================== 私有bucket签名URL ====================
/**
 * 生成私有bucket资源的访问签名URL
 * 用于视频播放防盗（在URL中加入时效签名）
 *
 * @param {string} key - 七牛存储key，如 'videos/course_1.m3u8'
 * @param {number} expires - 签名有效期（秒），默认3600
 * @returns {string} 带签名的播放URL
 */
function createSignedUrl(key, expires = SIGNED_URL_EXPIRE) {
  if (!isConfigured()) {
    // 未配置时返回空字符串，前端不播放
    return '';
  }
  const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
  const config = new qiniu.conf.Config();
  config.zone = getZone(); // 必须指定zone
  const bucketManager = new qiniu.rs.BucketManager(mac, config);

  return new Promise((resolve, reject) => {
    const deadline = Math.floor(Date.now() / 1000) + expires;
    // 根据 key 类型选择 bucket 源站域名（RS API 必须用源站域名，不能用 CDN 域名）
    const baseDomain = key.startsWith('videos/') ? getVideoBucketDomain() : getImageBucketDomain();
    const encodedStr = qiniu.util.generateAccessTokenV2(bucketManager, '/' + key + '?d=' + deadline, 'GET');
    const baseUrl = (baseDomain.startsWith('http') ? baseDomain : 'https://' + baseDomain) + '/' + key;
    const signedUrl = baseUrl + '?' + encodedStr.split('?')[1];
    resolve(signedUrl);
  });
}

/**
 * 同步版本（推荐用于播放量大的场景，减少异步开销）
 * 支持 HLS (.m3u8) 播放列表，自动重写所有 .ts 分片的签名 URL
 *
 * 图片和视频统一使用 QBox Token（privateDownloadUrl）下载：
 * - 图片用 pictures.hhlfedu.com + QBox token
 * - 视频用 videos.hhlfedu.com + QBox token
 */
function createSignedUrlSync(key, expires = SIGNED_URL_EXPIRE) {
  if (!isConfigured()) {
    return '';
  }

  // 图片 key：统一走私有 bucket + QBox 签名（七牛 CDN 统一鉴权）
  if (key.startsWith('images/')) {
    return createQboxSignedUrl(key, PICTURE_DOMAIN, expires);
  }
  // 视频 key 或其他（m3u8、ts分片等）：统一走视频 CDN（需签名）
  return createQboxSignedUrl(key, VIDEO_DOMAIN, expires);
}
/**
 * 拉取 m3u8 播放列表并返回所有分片已签名的完整内容
 * 用于 HLS 自适应码流：播放器请求此接口 → 后端拉取 m3u8 → 签名所有 .ts URL → 返回完整内容
 *
 * @param {string} m3u8Key - 七牛存储 key（格式：videos/course_X_Y.m3u8）
 * @returns {Promise<{signedM3u8: string, contentType: string}>}
 */
async function getSignedHlsPlaylist(m3u8Key, mode = 'signed', expires = SIGNED_URL_EXPIRE) {
  if (!isConfigured()) {
    throw new Error('七牛云未配置');
  }

  // 缓存只用于 signed 模式；relative 模式每次实时生成（路径不同，不能共用缓存）
  if (mode === 'signed') {
    const cached = getCachedM3u8(m3u8Key);
    if (cached) {
      return cached;
    }
  }

  // 拉取原始 m3u8 内容（通过 CDN + QBox token）
  let hlsContent = '';
  const contentType = 'application/vnd.apple.mpegurl';

  try {
    const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
    const config = new qiniu.conf.Config();
    config.zone = getZone();
    const bucketManager = new qiniu.rs.BucketManager(mac, config);
    const deadline = Math.floor(Date.now() / 1000) + expires;
    // 使用 CDN 域名 + QBox token 拉取（需带 https:// 前缀）
    const signedUrl = bucketManager.privateDownloadUrl(VIDEO_DOMAIN, m3u8Key, deadline);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
    hlsContent = await response.text();
  } catch (e) {
    throw new Error(`拉取 m3u8 失败: ${e.message}`);
  }

  // 签名所有 .ts 分片路径（mode='relative' 时生成相对路径，mode='signed' 时生成签名 URL）
  const signedM3u8 = signHlsContent(hlsContent, mode);
  const result = { signedM3u8, contentType };

  // signed 模式写入缓存；relative 模式不缓存
  if (mode === 'signed') {
    setCachedM3u8(m3u8Key, result);
  }
  return result;
}

// ==================== 图片代理（后端拉取再转发） ====================
/**
 * 后端代理拉取图片（参考 .ts 分片代理模式）
 * 私有 bucket 无法直接给前端签名 URL（QBox token 不被 CDN 接受），
 * 改为后端用 RS API 拉取图片再转发给前端
 *
 * @param {string} key - 七牛存储 key（格式：images/xxx.jpg）
 * @returns {Promise<{data: Buffer, contentType: string}>}
 */
async function fetchImage(key) {
  if (!isConfigured()) {
    throw new Error('七牛云未配置');
  }

  const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
  const config = new qiniu.conf.Config();
  config.zone = getZone();
  const bucketManager = new qiniu.rs.BucketManager(mac, config);

  // 使用七牛 bucket 源站域名 fetch（CDN 不接受 QBox token）
  // 源站域名格式：bucket.zN.qiniup.com
  const deadline = Math.floor(Date.now() / 1000) + SIGNED_URL_EXPIRE;
  const signedUrl = bucketManager.privateDownloadUrl(PICTURE_DOMAIN, key, deadline);

  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();

  return { data: Buffer.from(buffer), contentType };
}

// ==================== 回调通知处理 ====================
/**
 * 验证七牛转码回调的签名
 * 七牛会在回调请求中加入 Authorization header
 */
function verifyCallback(authHeader, bodyRaw) {
  if (!isConfigured()) return false;
  const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
  const expected = 'Qiniu ' + mac.signBuffer(bodyRaw);
  return authHeader === expected;
}

// ==================== 图片key生成 ====================
/**
 * 生成课程封面图片存储key
 * 格式：images/course_{course_id}_{timestamp}.{ext}
 */
function generateImageKey(courseId, originalFilename) {
  const ext = originalFilename.split('.').pop().toLowerCase();
  const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const finalExt = allowedExts.includes(ext) ? ext : 'jpg';
  return `images/course_${courseId || 0}_${Date.now()}.${finalExt}`;
}

// ==================== 删除视频（管理用） ====================
/**
 * 从七牛删除文件
 */
function deleteFile(key) {
  if (!isConfigured()) {
    return Promise.resolve({ success: true, msg: '七牛未配置，跳过删除' });
  }
  const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
  const config = new qiniu.conf.Config();
  config.zone = getZone(); // 必须指定zone，否则SDK查询region失败（bucket不存在）
  const bucketManager = new qiniu.rs.BucketManager(mac, config);

  return new Promise((resolve, reject) => {
    bucketManager.delete(BUCKET_VIDEO, key, (err, respBody, respInfo) => {
      if (err) return reject(err);
      resolve({ success: respInfo.statusCode === 200, info: respBody });
    });
  });
}

// ==================== 视频key生成 ====================
/**
 * 生成课程视频存储key
 * 格式：videos/course_{course_id}_{timestamp}.{ext}
 */
function generateVideoKey(courseId, originalFilename) {
  const ext = originalFilename.split('.').pop().toLowerCase();
  return `videos/course_${courseId}_${Date.now()}.${ext}`;
}

// ==================== PFOP 持久化转码触发 ====================
/**
 * 触发七牛 PFOP 视频转码（MP4 → HLS）
 * 转码完成后七牛回调 /api/video/notify
 *
 * @param {number} courseId - 课程ID
 * @param {string} mp4Key - 原始MP4的七牛存储key
 * @param {string} callbackUrl - 转码完成回调地址，如 https://api.hhlfedu.com/api/video/notify
 * @returns {Promise<{persistentId: string}>}
 */
async function triggerPfop(courseId, mp4Key, callbackUrl) {
  if (!isConfigured()) {
    throw new Error('七牛云未配置');
  }
  const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
  const config = new qiniu.conf.Config();
  config.zone = getZone();
  const oper = new qiniu.fop.OperationManager(mac, config);

  // 生成输出 key：videos/course_{id}_{timestamp}.m3u8
  const mp4Ext = mp4Key.match(/\.(\w+)$/)?.[0] || '.mp4';
  const outputKey = mp4Key.replace(/\.\w+$/, '.m3u8');
  const saveas = qiniu.util.urlsafeBase64Encode(BUCKET_VIDEO + ':' + outputKey);
  const fopCmd = 'avthumb/m3u8/avcodec/h264/acodec/aac/segtime/10|saveas/' + saveas;

  return new Promise((resolve, reject) => {
    oper.pfop(
      BUCKET_VIDEO,    // bucket
      mp4Key,          // key（原始MP4）
      [fopCmd],        // 转HLS并保存到 outputKey
      null,            // pipeline（null=默认公共队列）
      { notifyURL: callbackUrl },
      (err, respBody, respInfo) => {
        if (err) {
          console.error('[triggerPfop] err:', err);
          return reject(err);
        }
        if (respInfo.statusCode !== 200) {
          return reject(new Error(`PFOP请求失败: ${respInfo.statusCode} ${JSON.stringify(respBody)}`));
        }
        console.log(`[triggerPfop] 课程${courseId} 提交转码 persistentId=${respBody.persistentId}`);
        resolve({ persistentId: respBody.persistentId });
      }
    );
  });
}

module.exports = {
  isConfigured,
  createUploadToken,
  createImageUploadToken,
  createSignedUrl,
  createSignedUrlSync,
  signHlsContent,
  getSignedHlsPlaylist,
  fetchImage,
  verifyCallback,
  deleteFile,
  triggerPfop,
  generateVideoKey,
  generateImageKey,
  getUploadHost,
  getPublicUrl(key) {
    if (!PUBLIC_DOMAIN) return key;
    return (PUBLIC_DOMAIN.startsWith('http') ? PUBLIC_DOMAIN : 'https://' + PUBLIC_DOMAIN) + '/' + key;
  },
};
