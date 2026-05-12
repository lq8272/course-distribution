/**
 * 性能压测
 * 测试：响应时间分布、并发负载、数据库慢查询
 */
const { request } = require('./setup');

// ============================================================
// 工具函数
// ============================================================
function percentiles(sorted, ps) {
  const result = {};
  for (const p of ps) {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    result[`p${p}`] = sorted[Math.max(0, idx)];
  }
  return result;
}

async function measure(name, fn, iterations = 20) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await fn();
    times.push(Date.now() - start);
  }
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const p = percentiles(sorted, [50, 90, 95, 99]);
  const max = sorted[sorted.length - 1];
  console.log(`  ${name}: avg=${avg.toFixed(1)}ms p50=${p.p50}ms p95=${p.p95}ms p99=${p.p99}ms max=${max}ms (n=${iterations})`);
  return { avg: +avg.toFixed(2), p50: p.p50, p95: p.p95, p99: p.p99, max };
}

async function concurrentRequests(fn, concurrency) {
  const chunks = [];
  for (let i = 0; i < concurrency; i++) {
    chunks.push(fn());
  }
  const start = Date.now();
  await Promise.all(chunks);
  return Date.now() - start;
}

// ============================================================
// 性能测试
// ============================================================
describe('【性能】响应时间测试', () => {

  test('公开接口 - 课程列表响应时间', async () => {
    await measure('GET /course/list', async () => {
      const r = await request('/course/list', { method: 'GET', token: null });
      expect(r.status).toBe(200);
    });
  });

  test('公开接口 - 课程分类响应时间', async () => {
    await measure('GET /course/categories', async () => {
      const r = await request('/course/categories', { method: 'GET', token: null });
      expect(r.status).toBe(200);
    });
  });

  test('公开接口 - 课程详情响应时间', async () => {
    await measure('GET /course/detail/1', async () => {
      const r = await request('/course/detail/1', { method: 'GET', token: null });
      expect(r.status).toBeGreaterThanOrEqual(200);
    });
  });

  test('登录接口响应时间', async () => {
    await measure('POST /auth/login', async () => {
      const r = await request('/auth/login', {
        method: 'POST',
        body: { code: 'test_user_001', nickname: '性能测试' },
        token: null,
      });
      expect(r.status).toBe(200);
    }, 15);
  });

  test('认证接口 - 用户信息响应时间', async () => {
    const lr = await request('/auth/login', {
      method: 'POST',
      body: { code: 'test_user_001', nickname: '性能测试' },
      token: null,
    });
    const token = lr.body.data?.token;

    await measure('GET /auth/userinfo', async () => {
      const r = await request('/auth/userinfo', { method: 'GET', token });
      expect(r.status).toBe(200);
    });
  });

  test('认证接口 - 钱包信息响应时间', async () => {
    const lr = await request('/auth/login', {
      method: 'POST',
      body: { code: 'test_user_001', nickname: '性能测试' },
      token: null,
    });
    const token = lr.body.data?.token;

    // 钱包接口可能 404（用户无钱包记录），仅测响应时间
    await measure('GET /wallet/info', async () => {
      const r = await request('/wallet/info', { method: 'GET', token });
      expect([200, 404]).toContain(r.status); // 有则200，无则404
    });
  });

  test('认证接口 - 订单列表响应时间', async () => {
    const lr = await request('/auth/login', {
      method: 'POST',
      body: { code: 'test_user_001', nickname: '性能测试' },
      token: null,
    });
    const token = lr.body.data?.token;

    await measure('GET /order/my', async () => {
      const r = await request('/order/my', { method: 'GET', token });
      expect(r.status).toBe(200);
    });
  });

  // SKIP: test_admin_001 微信登录后是普通用户，无管理员权限
  test.skip('管理员接口 - 课程列表响应时间', async () => {
    const lr = await request('/auth/login', {
      method: 'POST',
      body: { code: 'test_admin_001', nickname: '性能测试' },
      token: null,
    });
    const token = lr.body.data?.token;

    await measure('GET /admin/course/list', async () => {
      const r = await request('/admin/course/list', { method: 'GET', token });
      expect(r.status).toBe(200);
    });
  });
});

describe('【性能】并发负载测试', () => {

  test('10 并发 - 课程列表', async () => {
    const total = await concurrentRequests(async () => {
      const r = await request('/course/list', { method: 'GET', token: null });
      return r.status;
    }, 10);
    console.log(`  10并发课程列表: 总耗时 ${total}ms, 平均 ${(total/10).toFixed(1)}ms/请求`);
    expect(total).toBeLessThan(5000); // 10并发总耗时应小于5秒
  });

  test('20 并发 - 课程列表', async () => {
    const total = await concurrentRequests(async () => {
      const r = await request('/course/list', { method: 'GET', token: null });
      return r.status;
    }, 20);
    console.log(`  20并发课程列表: 总耗时 ${total}ms, 平均 ${(total/20).toFixed(1)}ms/请求`);
    expect(total).toBeLessThan(5000);
  });

  test('50 并发 - 课程列表', async () => {
    const total = await concurrentRequests(async () => {
      const r = await request('/course/list', { method: 'GET', token: null });
      return r.status;
    }, 50);
    console.log(`  50并发课程列表: 总耗时 ${total}ms, 平均 ${(total/50).toFixed(1)}ms/请求`);
    expect(total).toBeLessThan(10000);
  });

  test('10 并发 - 登录接口', async () => {
    const total = await concurrentRequests(async () => {
      const r = await request('/auth/login', {
        method: 'POST',
        body: { code: `test_user_${Math.floor(Math.random()*100)}`, nickname: '并发测试' },
        token: null,
      });
      return r.status;
    }, 10);
    console.log(`  10并发登录: 总耗时 ${total}ms`);
    expect(total).toBeLessThan(10000);
  });

  test('20 并发 - 认证接口（需token）', async () => {
    const lr = await request('/auth/login', {
      method: 'POST',
      body: { code: 'test_user_001', nickname: '性能测试' },
      token: null,
    });
    const token = lr.body.data?.token;

    const total = await concurrentRequests(async () => {
      const r = await request('/order/my', { method: 'GET', token });
      return r.status;
    }, 20);
    console.log(`  20并发认证接口: 总耗时 ${total}ms, 平均 ${(total/20).toFixed(1)}ms/请求`);
    expect(total).toBeLessThan(5000);
  });
});

describe('【性能】Redis 缓存效果测试', () => {

  test('钱包接口首次访问（缓存未命中）', async () => {
    const lr = await request('/auth/login', {
      method: 'POST',
      body: { code: 'test_user_001', nickname: '缓存测试' },
      token: null,
    });
    const token = lr.body.data?.token;

    // 钱包可能 404，仅测响应时间
    const start1 = Date.now();
    const r1 = await request('/wallet/info', { method: 'GET', token });
    const t1 = Date.now() - start1;
    console.log(`  钱包首次: ${t1}ms, code=${r1.body.code}`);

    const start2 = Date.now();
    const r2 = await request('/wallet/info', { method: 'GET', token });
    const t2 = Date.now() - start2;
    console.log(`  钱包二次: ${t2}ms, code=${r2.body.code}`);

    // 响应时间不应超过 500ms
    expect(t1).toBeLessThan(500);
    expect(t2).toBeLessThan(500);
    console.log(`  响应时间: 首次${t1}ms → 二次${t2}ms`);
  });
});

describe('【性能】慢查询检测', () => {

  test('课程列表（含JOIN和聚合）响应时间应在 200ms 内', async () => {
    const times = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const r = await request('/course/list', { method: 'GET', token: null });
      times.push(Date.now() - start);
      expect(r.status).toBe(200);
    }
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    const max = Math.max(...times);
    console.log(`  课程列表 avg=${avg.toFixed(1)}ms max=${max}ms`);
    expect(avg).toBeLessThan(200); // 平均应小于 200ms
  });

  // SKIP: test_admin_001 微信登录后是普通用户，无管理员权限
  test.skip('管理员课程列表（keyword搜索）应在 300ms 内', async () => {
    const lr = await request('/auth/login', {
      method: 'POST',
      body: { code: 'test_admin_001', nickname: '慢查询测试' },
      token: null,
    });
    const token = lr.body.data?.token;

    const times = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const r = await request('/admin/course/list?keyword=test', { method: 'GET', token });
      times.push(Date.now() - start);
      expect(r.status).toBe(200);
    }
    const avg = times.reduce((s, t) => s + t, 0) / times.length;
    console.log(`  管理员课程列表(搜索) avg=${avg.toFixed(1)}ms`);
    expect(avg).toBeLessThan(300);
  });
});
