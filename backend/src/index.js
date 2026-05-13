const express = require('express');
const http = require('http');
const cors = require('cors');
const config = require('./config');
const rateLimit = require('./middleware/ratelimit');
const wsService = require('./websocket');

// 路由
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/course');
const orderRoutes = require('./routes/order');
const agentRoutes = require('./routes/agent');
const teamRoutes = require('./routes/team');
const commissionRoutes = require('./routes/commission');
const adminRoutes = require('./routes/admin');
const adminCourseRoutes = require('./routes/admin-course');
const adminCategoryRoutes = require('./routes/admin-category');
const adminServiceRoutes = require('./routes/admin/service');
const serviceRoutes = require('./routes/service');
const purchaseRoutes = require('./routes/purchase');
const userRoutes = require('./routes/user');
const notificationRoutes = require('./routes/notification');
const mycoursesRoutes = require('./routes/mycourses');
const videoRoutes = require('./routes/video');

const app = express();

// 中间件
// 信任一层代理（用于限流正确获取真实 IP）
app.set('trust proxy', 1);
const corsOptions = {
  origin: (origin, callback) => {
    // 开发环境（无 origin）或已配置允许的域名列表
    const allowed = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());
    if (!origin || allowed.includes('*') || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允许的来源: ' + origin));
    }
  },
  credentials: true,
};
app.use(cors(corsOptions));
// body 解析限制（支持大请求，如获取上传凭证）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志（简洁）
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - t;
    if (req.path !== '/api/health') {
      console.log(`${new Date().toISOString().slice(11,19)} ${res.statusCode} ${ms}ms ${req.method} ${req.path}`);
    }
  });
  next();
});

// ========== 接口 ==========

// 健康检查（O2 P0）
app.get('/api/health', async (req, res) => {
  const { checkConnection: checkDb } = require('./config/database');
  const { getRedis } = require('./config/redis');
  let dbOk = false, redisOk = false;
  try { dbOk = await checkDb(); } catch {}
  // Redis: status='ready' 表示已连接
  try { redisOk = getRedis().status === 'ready'; } catch {}
  res.json({
    status: dbOk && redisOk ? 'ok' : 'degraded',
    timestamp: Math.floor(Date.now() / 1000),
    uptime: process.uptime(),
    mysql: dbOk ? 'ok' : 'fail',
    redis: redisOk ? 'ok' : 'fail',
  });
});

// 监控指标（Prometheus 格式，/api/metrics）
app.get('/api/metrics', (req, res) => {
  const mem = process.memoryUsage();
  const { getPool } = require('./config/database');
  const { getRedis } = require('./config/redis');

  const pool = getPool();
  const poolStatus = pool._pool ? pool._pool._allConnections?.length || 0 : 0;
  const poolFree   = pool._pool ? pool._pool._freeConnections?.length || 0 : 0;

  // WebSocket 连接数统计
  let wsTotal = 0, wsUsers = 0, wsAdmins = 0;
  try {
    const stats = wsService.getStats();
    wsTotal = stats.total || 0;
    wsUsers = stats.users || 0;
    wsAdmins = stats.admins || 0;
  } catch {}

  // Node.js 运行时指标
  const lines = [
    `# HELP nodejs_memory_heap_used_bytes Node.js heap used bytes`,
    `# TYPE nodejs_memory_heap_used_bytes gauge`,
    `nodejs_memory_heap_used_bytes ${mem.heapUsed}`,
    `# HELP nodejs_memory_heap_total_bytes Node.js heap total bytes`,
    `# TYPE nodejs_memory_heap_total_bytes gauge`,
    `nodejs_memory_heap_total_bytes ${mem.heapTotal}`,
    `# HELP nodejs_memory_rss_bytes Node.js RSS bytes`,
    `# TYPE nodejs_memory_rss_bytes gauge`,
    `nodejs_memory_rss_bytes ${mem.rss}`,
    `# HELP process_uptime_seconds Process uptime in seconds`,
    `# TYPE process_uptime_seconds counter`,
    `process_uptime_seconds ${Math.floor(process.uptime())}`,
    `# HELP mysql_connections_total MySQL total connections`,
    `# TYPE mysql_connections_total gauge`,
    `mysql_connections_total ${poolStatus}`,
    `# HELP mysql_connections_free MySQL free connections`,
    `# TYPE mysql_connections_free gauge`,
    `mysql_connections_free ${poolFree}`,
    `# HELP mysql_connections_waiting MySQL waiting connections`,
    `# TYPE mysql_connections_waiting gauge`,
    `mysql_connections_waiting ${pool._waiters?.length || 0}`,
    `# HELP redis_connected Redis connection status (1=connected)`,
    `# TYPE redis_connected gauge`,
    `redis_connected ${getRedis().status === 'ready' ? 1 : 0}`,
    `# HELP websocket_connections_total WebSocket total connections`,
    `# TYPE websocket_connections_total gauge`,
    `websocket_connections_total ${wsTotal}`,
    `# HELP websocket_users_total WebSocket unique users`,
    `# TYPE websocket_users_total gauge`,
    `websocket_users_total ${wsUsers}`,
    `# HELP websocket_admins_total WebSocket admin connections`,
    `# TYPE websocket_admins_total gauge`,
    `websocket_admins_total ${wsAdmins}`,
  ];

  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.send(lines.join('\n'));
});

// API 路由（/api/v1/ 版本）
// 限流：登录接口最严（10次/分钟），下单/提现次之（15次/分钟）
// 测试环境下（NODE_ENV=test）将限额临时调高，避免自动化测试触发 429
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/v1/auth/login', rateLimit({ windowSec: 60, max: 10, keyPrefix: 'login' }));
  app.use('/api/v1/admin/login', rateLimit({ windowSec: 60, max: 10, keyPrefix: 'admin_login' }));
  app.use('/api/v1/order/create', rateLimit({ windowSec: 60, max: 15, keyPrefix: 'order' }));
  app.use('/api/v1/commission/withdraw', rateLimit({ windowSec: 60, max: 15, keyPrefix: 'withdraw' }));
}
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/course', courseRoutes);
app.use('/api/v1/order', orderRoutes);
app.use('/api/v1/agent', agentRoutes);
app.use('/api/v1/team', teamRoutes);
app.use('/api/v1/commission', commissionRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin/course', adminCourseRoutes);
app.use('/api/v1/admin/category', adminCategoryRoutes);
app.use('/api/v1/admin/service', adminServiceRoutes);
app.use('/api/v1/service', serviceRoutes);
app.use('/api/v1/purchase', purchaseRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/my', mycoursesRoutes);
app.use('/api/v1/video', videoRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ code: 40400, message: '接口不存在' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack);
  res.status(500).json({ code: 50000, message: '服务器内部错误' });
});

const PORT = config.port;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`\n  视频课程分销系统 - API 服务启动`);
  console.log(`  端口: ${PORT}`);
  console.log(`  环境: ${config.nodeEnv}\n`);

  // 初始化 WebSocket（共享同一 HTTP server）
  wsService.init(server);

  // 订单超时关闭定时任务（每 5 分钟检查一次）
  const { Order } = require('./models/Order');
  setInterval(async () => {
    try {
      const closed = await Order.closeTimeout();
      if (closed > 0) console.log(`[Cron] 关闭 ${closed} 笔超时订单`);
    } catch (e) {
      console.error('[Cron] closeTimeout 错误', e.message);
    }
  }, 5 * 60 * 1000);
});

module.exports = { server, app };
