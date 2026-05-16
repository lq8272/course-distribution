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

// ==================== 配置 ====================
// 七牛云账号 → https://portal.qiniu.com/user/key
const ACCESS_KEY = process.env.QINIU_ACCESS_KEY || '';
const SECRET_KEY = process.env.QINIU_SECRET_KEY || '';
// 存储空间名（图片和视频分开）
const BUCKET_IMAGE = process.env.QINIU_BUCKET_IMAGE || '';
const BUCKET_VIDEO = process.env.QINIU_BUCKET_VIDEO || '';
// 公开域名前缀（图片 bucket 的 CDN 域名）
const PUBLIC_DOMAIN = process.env.QINIU_PUBLIC_DOMAIN || '';
// 视频 bucket 域名（私有 bucket 签名用，用于视频播放）
const VIDEO_DOMAIN = process.env.QINIU_VIDEO_DOMAIN || PUBLIC_DOMAIN;
// 私有bucket签名URL有效期（秒），默认1小时
const SIGNED_URL_EXPIRE = parseInt(process.env.QINIU_URL_EXPIRE || '3600');
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

// 是否已配置（未配置时返回友好提示）
const isConfigured = () => !!(ACCESS_KEY && SECRET_KEY && BUCKET_IMAGE && BUCKET_VIDEO);

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
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: BUCKET_IMAGE + ':' + key,
    expires: 7200,
    fsizeLimit: 20 * 1024 * 1024, // 20MB
    mimeLimit: 'image/jpeg;image/png;image/gif;image/webp;image/heic',
  });
  return {
    token: putPolicy.uploadToken(mac),
    key,
    expires: 7200,
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
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: BUCKET_VIDEO + ':' + key,   // 限定只能上传到指定key，防止覆盖他人文件
    expires: 7200,                 // 凭证有效期2小时
    fsizeLimit: 500 * 1024 * 1024, // 500MB
    mimeLimit: 'video/*',          // 只允许视频文件
  });
  return {
    token: putPolicy.uploadToken(mac),
    key,
    expires: 7200,
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
    // 根据 key 类型选择域名
    const baseDomain = key.startsWith('videos/') ? VIDEO_DOMAIN : PUBLIC_DOMAIN;
    const encodedStr = qiniu.util.generateAccessTokenV2(bucketManager, '/' + key + '?d=' + deadline, 'GET');
    const baseUrl = (baseDomain.startsWith('http') ? baseDomain : 'https://' + baseDomain) + '/' + key;
    const signedUrl = baseUrl + '?' + encodedStr.split('?')[1];
    resolve(signedUrl);
  });
}

/**
 * 同步版本（推荐用于播放量大的场景，减少异步开销）
 * 支持 HLS (.m3u8) 播放列表，自动重写所有 .ts 分片的签名 URL
 */
function createSignedUrlSync(key, expires = SIGNED_URL_EXPIRE) {
  if (!isConfigured()) {
    return '';
  }
  const mac = new qiniu.auth.digest.Mac(ACCESS_KEY, SECRET_KEY);
  const config = new qiniu.conf.Config();
  config.zone = getZone();
  const bucketManager = new qiniu.rs.BucketManager(mac, config);
  // 根据 key 类型选择域名：videos/* 用视频 bucket 域名，images/* 用图片域名
  const domainRaw = key.startsWith('videos/') ? VIDEO_DOMAIN : PUBLIC_DOMAIN;
  const domain = domainRaw.replace(/^https?:\/\//, '');
  const deadline = Math.floor(Date.now() / 1000) + expires;
  // 七牛 privateDownloadUrl 返回无协议 URL，需追加 http:// 前缀
  return 'http://' + bucketManager.privateDownloadUrl(domain, key, deadline);
}

/**
 * 为 HLS 播放列表内容生成签名后的完整 URL（供播放器直接使用）
 * 替换 m3u8 中所有 .ts 分片路径为完整签名 URL
 *
 * @param {string} hlsContent - 原始 m3u8 文件内容文本
 * @param {number} expires - 签名有效期（秒），默认3600
 * @returns {string} 签名后的 m3u8 内容
 */
function signHlsContent(hlsContent, expires = SIGNED_URL_EXPIRE) {
  if (!isConfigured()) return hlsContent;
  const deadline = Math.floor(Date.now() / 1000) + expires;
  // HLS 分片统一使用视频域名
  const domainRaw = VIDEO_DOMAIN;
  const domain = domainRaw.startsWith('http') ? domainRaw : 'https://' + domainRaw;

  // 匹配所有 .ts 分片路径（支持不同目录层级）
  return hlsContent.replace(/^(.+?\.(?:ts|key))(.*)$/gm, (match, tsPath, querySuffix) => {
    // 移除已有的查询参数（防止双重签名）
    const cleanPath = tsPath.split('?')[0];
    const signedPath = '/' + cleanPath + '?d=' + deadline;
    const hmac = crypto.createHmac('sha1', SECRET_KEY);
    hmac.update(signedPath);
    const encoded = qiniu.util.urlsafeBase64Encode(hmac.digest('base64'));
    return domain + cleanPath + '?e=' + deadline + '&token=' + ACCESS_KEY + ':' + encoded;
  });
}

/**
 * 拉取 m3u8 播放列表并返回所有分片已签名的完整内容
 * 用于 HLS 自适应码流：播放器请求此接口 → 后端拉取 m3u8 → 签名所有 .ts URL → 返回完整内容
 *
 * @param {string} m3u8Key - 七牛存储 key（格式：videos/course_X_Y.m3u8）
 * @returns {Promise<{signedM3u8: string, contentType: string}>}
 */
async function getSignedHlsPlaylist(m3u8Key) {
  if (!isConfigured()) {
    throw new Error('七牛云未配置');
  }
  // 拉取原始 m3u8 使用视频域名
  const domainRaw = VIDEO_DOMAIN;
  const domain = domainRaw.startsWith('http') ? domainRaw : 'https://' + domainRaw;
  const m3u8Url = domain + '/' + m3u8Key;

  // 拉取原始 m3u8 内容
  const response = await fetch(m3u8Url);
  if (!response.ok) {
    throw new Error(`拉取 m3u8 失败: ${response.status} ${response.statusText}`);
  }
  const hlsContent = await response.text();
  const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';

  // 签名所有 .ts 分片路径
  const signedM3u8 = signHlsContent(hlsContent);
  return { signedM3u8, contentType };
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

module.exports = {
  isConfigured,
  createUploadToken,
  createImageUploadToken,
  createSignedUrl,
  createSignedUrlSync,
  signHlsContent,
  getSignedHlsPlaylist,
  verifyCallback,
  deleteFile,
  generateVideoKey,
  generateImageKey,
  getPublicUrl(key) {
    if (!PUBLIC_DOMAIN) return key;
    return (PUBLIC_DOMAIN.startsWith('http') ? PUBLIC_DOMAIN : 'https://' + PUBLIC_DOMAIN) + '/' + key;
  },
};
