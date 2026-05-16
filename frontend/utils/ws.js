/**
 * WebSocket 管理器 - 单例模式
 * 连接地址: ws://127.0.0.1:3000/ws?token=xxx
 *
 * 使用方式:
 *   import { wsManager } from '@/utils/ws';
 *   wsManager.connect();  // App.vue onLaunch 中调用
 *
 * 监听全局事件:
 *   uni.$on('ws_customer_message', (data) => { ... });   // 管理员收到用户消息
 *   uni.$on('ws_admin_reply',      (data) => { ... });    // 用户收到客服回复
 *   uni.$on('ws_notification',    (data) => { ... });    // 系统通知
 */

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:3000/ws';

// 心跳间隔 25s，超时 60s 判定断开
const HEARTBEAT_INTERVAL = 25000;
const HEARTBEAT_TIMEOUT  = 60000;

class WSManager {
  constructor() {
    this.socket = null;
    this.token = '';
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.lastPongAt = 0;
    this.connected = false;
    this._dumping = false;  // 防重入
  }

  connect() {
    if (this._dumping) return;
    this._dumping = true;

    const token = uni.getStorageSync('token');
    if (!token) {
      this._dumping = false;
      return; // 未登录，不连接
    }
    this.token = token;

    // 避免重复连接
    if (this.socket) {
      this.socket.close({ success: () => {} });
      this.socket = null;
    }

    console.log('[WS] 开始连接...');
    this.socket = uni.connectSocket({
      url: `${WS_URL}?token=${token}`,
      success: () => console.log('[WS] connectSocket 调用成功'),
      fail: (err) => {
        console.error('[WS] connectSocket 失败', err);
        this._dumping = false;
        this._scheduleReconnect();
      },
    });

    if (!this.socket) {
      this._dumping = false;
      this._scheduleReconnect();
      return;
    }

    this.socket.onOpen(() => {
      console.log('[WS] 连接已打开');
      this.connected = true;
      this._dumping = false;
      this.lastPongAt = Date.now();
      this._startHeartbeat();
      uni.$emit('ws_connected');
    });

    this.socket.onMessage((e) => {
      try {
        const msg = JSON.parse(e.data);
        console.log('[WS] 收到消息', msg.event, msg.data);
        this._dispatch(msg);
      } catch (err) {
        // 非 JSON 原文（可能是 ping）
        if (e.data === 'pong') {
          this.lastPongAt = Date.now();
        }
      }
    });

    this.socket.onClose(() => {
      console.log('[WS] 连接关闭');
      this._cleanup();
      this._scheduleReconnect();
    });

    this.socket.onError((err) => {
      console.error('[WS] 错误', err);
      this._cleanup();
      this._scheduleReconnect();
    });
  }

  /** 发送 JSON 消息 */
  send(event, data = {}) {
    if (!this.socket || !this.connected) {
      console.warn('[WS] 未连接，消息被丢弃:', event);
      return false;
    }
    const payload = JSON.stringify({ event, ...data });
    this.socket.send({ data: payload });
    return true;
  }

  /** 主动断开（不自动重连） */
  disconnect() {
    this._stopAll();
    if (this.socket) {
      this.socket.close({});
      this.socket = null;
    }
    this.connected = false;
  }

  _dispatch(msg) {
    const { event, data } = msg;
    switch (event) {
      case 'customer_message':
        // 管理员收到用户新消息 → 通知刷新会话列表
        uni.$emit('ws_customer_message', data);
        break;
      case 'admin_reply':
        // 用户收到客服回复 → 通知聊天页
        uni.$emit('ws_admin_reply', data);
        break;
      case 'conversation_updated':
        // 管理员间同步：会话列表有更新
        uni.$emit('ws_conversation_updated', data);
        break;
      case 'notification':
        // 系统通知
        uni.$emit('ws_notification', data);
        break;
      case 'pong':
        this.lastPongAt = Date.now();
        break;
      default:
        console.log('[WS] 未处理事件:', event);
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.connected || !this.socket) return;
      if (Date.now() - this.lastPongAt > HEARTBEAT_TIMEOUT) {
        console.warn('[WS] 心跳超时，强制断开重连');
        this.socket.close({});
        return;
      }
      this.socket.send({ data: 'ping' });
    }, HEARTBEAT_INTERVAL);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _scheduleReconnect() {
    this._dumping = false;
    if (this.reconnectTimer) return;
    console.log('[WS] 3 秒后尝试重连...');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  _stopAll() {
    this._stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  _cleanup() {
    this._stopAll();
    this.connected = false;
    this._dumping = false;
  }
}

/** 单例导出 */
export const wsManager = new WSManager();
