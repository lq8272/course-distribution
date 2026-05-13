/**
 * WebSocket 服务 - 实时消息推送
 * 架构：
 *   ws Server ↔ Redis pub/sub ↔ Express REST API
 *
 * 微信小程序端连接：wss://host/ws?token=xxx
 *
 * 推送事件类型：
 *   customer_message  用户→客服 新消息（推给客服）
 *   admin_reply       客服→用户 回复（推给用户）
 *   notification      系统通知（推给用户）
 */

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { getRedis, getRedisPub, getRedisSub, Redis } = require('./config/redis');

// 每个 userId → Set<ws>
const userClients = new Map();
// 每个 ws → { userId, isAdmin }
const clientInfo = new WeakMap();

// Redis pub/sub channels
const CHANNEL_TO_CLIENT = 'ws:to_client';
const CHANNEL_TO_ADMIN  = 'ws:to_admin';

let wss;

/**
 * 初始化 WebSocket 服务器
 * @param {http.Server} server - 共享的 HTTP server
 */
function init(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  // ── 客户端连接鉴权 ──
  wss.on('connection', async (ws, req) => {
    // 解析 token（?token=xxx）
    // 注意：URL 参数会落入 access.log，仅记录前6位用于问题追踪，不记录完整值
    const url = new URL(req.url, `http://${req.headers.host}`);
    const rawToken = url.searchParams.get('token');
    const tokenHint = rawToken ? `${rawToken.slice(0, 6)}***` : 'none';
    console.log(`[WS] 收到连接 token_hint=${tokenHint}`);

    const token = rawToken;
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      ws.close(4001, '无效token');
      return;
    }

    // 验证通过后再检查 Redis 黑名单（O4 机制），防止 logout 后 token 仍可用
    try {
      const redis = getRedis();
      const blacklisted = await redis.get(Redis.REDIS_KEYS.TOKEN_BLACKLIST(payload.jti));
      if (blacklisted) {
        ws.close(4002, 'token已失效');
        return;
      }
    } catch (err) {
      console.warn('[WS] 黑名单检查失败，允许连接:', err.message);
    }

    const userId = payload.id;
    const isAdmin = payload.is_admin || false;

    // 存储连接
    clientInfo.set(ws, { userId, isAdmin });
    if (!userClients.has(userId)) {
      userClients.set(userId, new Set());
    }
    userClients.get(userId).add(ws);

    console.log(`[WS] 连接: userId=${userId} isAdmin=${isAdmin} total=${userClients.get(userId).size}`);

    // ── 客户端消息（心跳/ping）──
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch {}
    });

    ws.on('close', () => {
      const info = clientInfo.get(ws);
      if (info) {
        const { userId } = info;
        const set = userClients.get(userId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) userClients.delete(userId);
        }
        clientInfo.delete(ws);
        console.log(`[WS] 断开: userId=${userId} remaining=${set?.size || 0}`);
      }
    });

    ws.on('error', (err) => {
      console.error(`[WS] 错误 userId=${clientInfo.get(ws)?.userId}:`, err.message);
    });
  });

  // ── 服务端主动心跳：每 30s 推送 ping，检测死连接 ──
  setInterval(() => {
    if (!wss || wss.clients.size === 0) return;
    let closed = 0;
    for (const ws of wss.clients) {
      if (ws.readyState !== 1) { // 非 OPEN
        ws.terminate();
        closed++;
        continue;
      }
      try {
        ws.ping(); // 触发客户端 pong，3s 内无响应则 on('error')/on('close') 被触发
      } catch {}
    }
    if (closed) console.log(`[WS] 心跳清理死连接 ${closed} 个`);
  }, 30_000);

  console.log('[WS] WebSocket 服务初始化完成，共享 HTTP server，path=/ws');

// ── 订阅：推给客户端（用户）──
function subscribeToClientChannel() {
  getRedisSub().subscribe(CHANNEL_TO_CLIENT, (err) => {
    if (err) console.error('[WS] 订阅 CHANNEL_TO_CLIENT 失败:', err.message);
  });
}
getRedisSub().on('message', (channel, message) => {
  if (channel !== CHANNEL_TO_CLIENT) return;
  try {
    const { userId, event, data } = JSON.parse(message);
    sendToUser(userId, event, data);
  } catch (e) {
    console.error('[WS] 处理推送消息失败:', e.message);
  }
});
// Redis 重连后重新订阅
getRedisSub().on('ready', () => {
  console.log('[WS] Redis Sub 已重连，重新订阅频道...');
  subscribeToClientChannel();
});

// ── 订阅：推给所有管理员（独立客户端，避免 subscribe 上下文冲突）──
const adminRedisSub = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});
function subscribeToAdminChannel() {
  adminRedisSub.subscribe(CHANNEL_TO_ADMIN, (err) => {
    if (err) console.error('[WS] 订阅 CHANNEL_TO_ADMIN 失败:', err.message);
  });
}
adminRedisSub.on('message', (channel, message) => {
  if (channel !== CHANNEL_TO_ADMIN) return;
  try {
    const { event, data } = JSON.parse(message);
    sendToAllAdmins(event, data);
  } catch (e) {
    console.error('[WS] 处理管理员推送失败:', e.message);
  }
});
// Redis 重连后重新订阅
adminRedisSub.on('ready', () => {
  console.log('[WS] Admin Redis Sub 已重连，重新订阅频道...');
  subscribeToAdminChannel();
});

// 初始化订阅
subscribeToClientChannel();
subscribeToAdminChannel();

console.log('[WS] WebSocket 服务初始化完成');
}

/**
 * 通过 Redis PUBLISH 发布推送消息（所有 subscriber 都会收到）
 * @param {string} channel - CHANNEL_TO_CLIENT 或 CHANNEL_TO_ADMIN
 * @param {object} payload
 */
function publish(channel, payload) {
  getRedisPub().publish(channel, JSON.stringify(payload)).catch((err) => {
    console.error(`[WS] 发布失败 channel=${channel}:`, err.message);
  });
}

/**
 * 发送消息给指定用户的所有 WebSocket 连接
 */
function sendToUser(userId, event, data) {
  const set = userClients.get(userId);
  if (!set || set.size === 0) return false;
  const payload = JSON.stringify({ event, data, ts: Date.now() });
  let sent = 0;
  for (const ws of set) {
    if (ws.readyState === 1) { // OPEN
      ws.send(payload);
      sent++;
    }
  }
  console.log(`[WS] 推送→ userId=${userId} event=${event} sent=${sent}/${set.size}`);
  return sent > 0;
}

/**
 * 推送给所有管理员 WebSocket 连接
 */
function sendToAllAdmins(event, data) {
  let sent = 0;
  for (const [, set] of userClients) {
    for (const ws of set) {
      const info = clientInfo.get(ws);
      if (info?.isAdmin && ws.readyState === 1) {
        ws.send(JSON.stringify({ event, data, ts: Date.now() }));
        sent++;
      }
    }
  }
  console.log(`[WS] 推送→ 全部管理员 event=${event} sent=${sent}`);
  return sent;
}

/**
 * REST API 调用：推送给指定用户
 */
function notifyUser(userId, event, data) {
  publish(CHANNEL_TO_CLIENT, { userId, event, data });
}

/**
 * REST API 调用：推送给所有管理员
 */
function notifyAdmins(event, data) {
  publish(CHANNEL_TO_ADMIN, { event, data });
}

/**
 * 获取当前连接数统计
 */
function getStats() {
  let total = 0, users = 0, admins = 0;
  for (const [userId, set] of userClients) {
    total += set.size;
    users++;
    for (const ws of set) {
      if (clientInfo.get(ws)?.isAdmin) admins++;
    }
  }
  return { total, users, admins };
}

module.exports = { init, notifyUser, notifyAdmins, sendToUser, getStats };
