const Redis = require('ioredis');
const config = require('./index');

let redisClient = null;
let redisPublisher = null;
let redisSubscriber = null;

function getRedis() {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] 连接错误:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] 连接成功');
    });
  }
  return redisClient;
}

// 独立的 Redis 客户端（专用于 PUBLISH，与 SUBSCRIBE 模式分离）
function getRedisPub() {
  if (!redisPublisher) {
    redisPublisher = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
    redisPublisher.on('error', (err) => {
      console.error('[Redis Pub] 连接错误:', err.message);
    });
  }
  return redisPublisher;
}

// 独立的 Redis 客户端（专用于 SUBSCRIBE 订阅模式）
function getRedisSub() {
  if (!redisSubscriber) {
    redisSubscriber = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
    redisSubscriber.on('error', (err) => {
      console.error('[Redis Sub] 连接错误:', err.message);
    });
  }
  return redisSubscriber;
}

// 供 health check 使用
async function checkConnection() {
  try {
    const pong = await getRedis().ping();
    return pong === 'PONG';
  } catch (e) {
    return false;
  }
}

// Redis Key 命名规范（O8）
const REDIS_KEYS = {
  // Token 黑名单（jti 为 JWT 的唯一 id）
  TOKEN_BLACKLIST: (jti) => `token:blacklist:${jti}`,
  // refresh_token 续期
  REFRESH_TOKEN: (uid) => `token:refresh:${uid}`,
  // 团队概览缓存（5分钟TTL）
  TEAM_OVERVIEW: (uid) => `team:overview:${uid}`,
  // 团队树缓存（5分钟TTL）
  TEAM_TREE: (uid) => `team:tree:${uid}`,
  // 佣金统计数据（1分钟TTL）
  AGENT_STATS: (uid) => `agent:stats:${uid}`,
  COMMISSION_STATS: (uid) => `commission:stats:${uid}`,
  // 课程列表缓存（10分钟TTL）
  COURSE_LIST: 'course:list',
  // 验证码（5分钟TTL）
  SMS_CODE: (mobile) => `sms:code:${mobile}`,
};

module.exports = { getRedis, getRedisPub, getRedisSub, checkConnection, REDIS_KEYS, Redis };
