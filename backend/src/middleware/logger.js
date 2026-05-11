/**
 * 结构化日志中间件
 * 输出 JSON 格式日志，便于日志收集器（Prometheus/Loki/Graylog）解析
 *
 * 格式：
 *  {"level":"INFO","ts":"2026-04-22T12:00:00.000Z","msg":"...","req_id":"...","method":"GET","path":"/api/xxx","status":200,"ms":12}
 */

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');

// 彩色控制台输出（开发环境）
const RESET = '\x1b[0m', RED = '\x1b[31m', YELLOW = '\x1b[33m', BLUE = '\x1b[36m';

function formatMsg(level, msg, meta) {
  const entry = { level, ts: new Date().toISOString(), msg, ...meta };
  if (process.env.NODE_ENV !== 'production') {
    const color = level === 'ERROR' ? RED : level === 'WARN' ? YELLOW : level === 'DEBUG' ? BLUE : RESET;
    console.log(`${color}[${entry.ts}][${level}]${RESET} ${msg}`, meta && Object.keys(meta).length ? meta : '');
  } else {
    console.log(JSON.stringify(entry));
  }
}

const log = {
  debug: (msg, meta) => { if (['DEBUG'].includes(LOG_LEVEL)) formatMsg('DEBUG', msg, meta); },
  info:  (msg, meta) => { if (['DEBUG','INFO'].includes(LOG_LEVEL)) formatMsg('INFO', msg, meta); },
  warn:  (msg, meta) => { formatMsg('WARN', msg, meta); },
  error: (msg, meta) => { formatMsg('ERROR', msg, meta); },
};

module.exports = { log };
