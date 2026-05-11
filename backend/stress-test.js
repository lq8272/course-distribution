/**
 * 轻量 HTTP 压测脚本
 * 使用内置模块，无依赖
 * 用法: node stress-test.js [并发数] [持续秒数]
 */
const http = require('http');

const BASE = process.env.TEST_API || 'http://localhost:3000/api';
const concurrency = parseInt(process.argv[2] || '50');   // 并发数，默认50
const durationSec = parseInt(process.argv[3] || '10');   // 持续秒数，默认10s

function request(method, path, token) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const start = Date.now();
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        const latency = Date.now() - start;
        try { data = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, latency, ok: res.statusCode < 400, data });
      });
    });
    req.on('error', (err) => resolve({ status: 0, latency: Date.now() - start, ok: false, error: err.message }));
    req.end();
  });
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function getTokens(count) {
  const tokens = [];
  // 顺序获取，每次间隔200ms，避免触发限流
  for (let i = 0; i < count; i++) {
    await new Promise(r => setTimeout(r, 200));
    const res = await request('POST', '/api/auth/login', null);
    if (res.data?.data?.token) {
      tokens.push(res.data.data.token);
      console.log(`  预热获取 token ${tokens.length}/${count}`);
    }
  }
  return tokens;
}

async function runLoadTest() {
  console.log(`\n========================================`);
  console.log(`  压测配置：并发 ${concurrency}，持续 ${durationSec}s`);
  console.log(`  目标服务器：${BASE}`);
  console.log(`========================================\n`);

  // 预热：获取与并发数同量的 token（顺序获取避免限流）
  console.log('开始预热获取 token...');
  const tokens = await getTokens(concurrency);
  if (!tokens.length) { console.error('❌ 无法获取 token，测试终止'); process.exit(1); }
  console.log(`✓ 成功获取 ${tokens.length} 个 token\n`);

  // 轮询分配 token 给 worker
  let tokenIdx = 0;
  const nextToken = () => { const t = tokens[tokenIdx % tokens.length]; tokenIdx++; return t; };

  const endpoints = [
    { name: 'GET  /api/health', method: 'GET', path: '/api/health', token: null },
    { name: 'GET  /api/course/list', method: 'GET', path: '/api/course/list', token: null },
    { name: 'GET  /api/course/categories', method: 'GET', path: '/api/course/categories', token: null },
    { name: 'GET  /api/auth/userinfo', method: 'GET', path: '/api/auth/userinfo', token },
    { name: 'GET  /api/order/my', method: 'GET', path: '/api/order/my', token },
    { name: 'GET  /api/commission/list', method: 'GET', path: '/api/commission/list', token },
    { name: 'GET  /api/team/overview', method: 'GET', path: '/api/team/overview', token },
  ];

  for (const ep of endpoints) {
    const latencies = [];
    let success = 0, failures = 0;
    let done = false;
    const endTime = Date.now() + durationSec * 1000;

    // 持续发送请求直到时间到
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push((async () => {
        while (Date.now() < endTime) {
          const r = await request(ep.method, ep.path, ep.token ? nextToken() : null);
          latencies.push(r.latency);
          if (r.ok) success++; else failures++;
        }
      })());
    }

    await Promise.all(workers);

    const total = success + failures;
    const rps = (total / durationSec).toFixed(1);
    const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    const p50 = latencies.length ? Math.round(percentile(latencies, 50)) : 0;
    const p95 = latencies.length ? Math.round(percentile(latencies, 95)) : 0;
    const p99 = latencies.length ? Math.round(percentile(latencies, 99)) : 0;
    const max = latencies.length ? Math.round(Math.max(...latencies)) : 0;
    const errorRate = total ? ((failures / total) * 100).toFixed(1) + '%' : '0%';

    console.log(`${ep.name.padEnd(35)} | RPS: ${rps.padStart(6)} | 成功率: ${(100 - parseFloat(errorRate)).toFixed(1).padStart(5)}% | 延迟: avg=${avg}ms p50=${p50}ms p95=${p95}ms p99=${p99}ms max=${max}ms`);
  }

  console.log('\n========================================');
  console.log('  压测完成');
  console.log('========================================\n');
}

runLoadTest().catch(console.error);
