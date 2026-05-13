require('dotenv').config();

// 生产环境启动时强制校验密钥，禁止使用默认值
const _nodeEnv = process.env.NODE_ENV || 'development';
const _jwtSecret = process.env.JWT_SECRET;
const _jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

if (_nodeEnv === 'production') {
  if (!_jwtSecret || !_jwtRefreshSecret) {
    console.error('========================================');
    console.error('[FATAL] 生产环境必须设置 JWT_SECRET 和 JWT_REFRESH_SECRET');
    console.error('请在 .env.production 中配置这两个环境变量');
    console.error('========================================');
    process.exit(1);
  }
  const forbidden = ['dev_secret', 'dev_refresh_secret', 'your-secret-key', 'CHANGE_THIS'];
  if (forbidden.includes(_jwtSecret) || forbidden.includes(_jwtRefreshSecret)) {
    console.error('========================================');
    console.error('[FATAL] JWT_SECRET / JWT_REFRESH_SECRET 不能使用默认占位符');
    console.error('请生成随机密钥: openssl rand -base64 64');
    console.error('========================================');
    process.exit(1);
  }
}

module.exports = {
  nodeEnv: _nodeEnv,
  port: parseInt(process.env.PORT) || 3000,

  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'course_distribute',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE) || 20,
    queueLimit: 0,
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // API 限流配置
  rateLimit: {
    login: { windowSec: 60, max: 10 },
    order: { windowSec: 60, max: 15 },
    withdraw: { windowSec: 60, max: 15 },
  },

  jwt: {
    secret: _jwtSecret || 'dev_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: _jwtRefreshSecret || _jwtSecret || 'dev_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  wechat: {
    appid: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || '',
  },

  oss: {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    endpoint: process.env.OSS_ENDPOINT || 'https://oss-cn-hangzhou.aliyuncs.com',
  },

  qiniu: {
    accessKey: process.env.QINIU_ACCESS_KEY || '',
    secretKey: process.env.QINIU_SECRET_KEY || '',
    bucketImage: process.env.QINIU_BUCKET_IMAGE || '',
    bucketVideo: process.env.QINIU_BUCKET_VIDEO || '',
    publicDomain: process.env.QINIU_PUBLIC_DOMAIN || '',
    urlExpire: parseInt(process.env.QINIU_URL_EXPIRE || '3600'),
  },

  platformRoot: {
    openid: process.env.PLATFORM_ROOT_OPENID || 'PLATFORM_ROOT',
    nickname: process.env.PLATFORM_ROOT_NICKNAME || '平台管理员',
  },
};
