/**
 * 管理后台核心接口冒烟测试
 * 直接请求运行中的后端服务器（http://localhost:3000）
 * 运行方式：NODE_ENV=test node tests/smoke-admin.test.js
 * 或 jest: npm test -- tests/smoke-admin.test.js
 */
const { request, apiRequest, loginWithRetry } = require('./setup');

const API_BASE = process.env.TEST_API || 'http://localhost:3000/api/v1';
let adminToken = null;
let adminUserId = null;

async function resp(label, res) {
  const ok = res.status >= 200 && res.status < 300;
  console.log(`  ${ok ? '✓' : '✗'} ${label} → ${res.status} ${res.body?.message || ''}`);
  return ok;
}

async function run() {
  console.log('\n========== 管理后台冒烟测试 ==========\n');

  // Step 1: 管理员登录（POST /api/admin/login，用账号+密码）
  console.log('[1/10] 管理员登录');
  const loginRes = await apiRequest('POST', '/api/admin/login', {
    username: 'test_admin_001',
    password: 'admin123',
  });
  if (loginRes.status !== 200 || !loginRes.body?.data?.token) {
    console.log(`  ✗ 管理员登录失败: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
    console.log('\n  注意: 需先设置 is_admin=1 并通过 /api/admin/user/password 设置密码');
    process.exit(1);
  }
  adminToken = loginRes.body.data.token;
  adminUserId = loginRes.body.data.user?.id;
  console.log(`  ✓ 登录成功，userId=${adminUserId}\n`);

  // Step 2: 概览统计（GET /admin/stats/overview）
  console.log('[2/10] 概览统计');
  let r = await apiRequest('GET', '/api/admin/stats/overview', null, adminToken);
  if (await resp('GET /admin/stats/overview', r)) {
    const d = r.body.data;
    console.log(`    订单: ${d.orders?.total} | 用户: ${d.users?.total} | 分销商: ${d.users?.agents}`);
  }

  // Step 3: 用户列表（GET /admin/user/list）
  console.log('\n[3/10] 用户列表');
  r = await apiRequest('GET', '/api/admin/user/list?page=1&page_size=5', null, adminToken);
  if (await resp('GET /admin/user/list', r)) {
    console.log(`    total=${r.body.data.total}, rows=${r.body.data.rows?.length}`);
  }

  // Step 4: 用户统计（GET /admin/user/stats）
  console.log('\n[4/10] 用户统计');
  r = await apiRequest('GET', '/api/admin/user/stats', null, adminToken);
  await resp('GET /admin/user/stats', r);
  if (r.status === 200) {
    const s = r.body.data;
    console.log(`    total=${s.total} regular=${s.regular} distributor=${s.distributor}`);
  }

  // Step 5: 课程列表（GET /admin/course/list）
  console.log('\n[5/10] 管理员课程列表');
  r = await apiRequest('GET', '/api/admin/course/list?page=1&page_size=5', null, adminToken);
  if (await resp('GET /admin/course/list', r)) {
    console.log(`    total=${r.body.data.total}`);
  }

  // Step 6: 系统配置（GET /admin/config + POST /admin/config）
  console.log('\n[6/10] 系统配置读写');
  r = await apiRequest('GET', '/api/admin/config', null, adminToken);
  if (await resp('GET /admin/config', r)) {
    console.log(`    配置项数量: ${r.body.data?.length ?? 'N/A'}`);
  }
  // 尝试批量更新（空数组，验证 POST 路由可达）
  r = await apiRequest('POST', '/api/admin/config', { items: [] }, adminToken);
  await resp('POST /admin/config (空更新)', r);

  // Step 7: 销售统计（GET /admin/stats/sales）
  console.log('\n[7/10] 销售统计');
  r = await apiRequest('GET', '/api/admin/stats/sales?period=30d', null, adminToken);
  if (await resp('GET /admin/stats/sales', r)) {
    const s = r.body.data;
    console.log(`    daily=${s.daily?.length} byCourse=${s.byCourse?.length} byLevel=${s.byLevel?.length}`);
  }

  // Step 8: 提现列表（GET /admin/withdraw/list）
  console.log('\n[8/10] 提现记录列表');
  r = await apiRequest('GET', '/api/admin/withdraw/list?page=1&page_size=5', null, adminToken);
  if (await resp('GET /admin/withdraw/list', r)) {
    console.log(`    total=${r.body.data.total}`);
  }

  // Step 9: 拿货记录列表（GET /admin/purchase/list）
  console.log('\n[9/10] 拿货记录列表');
  r = await apiRequest('GET', '/api/admin/purchase/list?page=1&page_size=5', null, adminToken);
  if (await resp('GET /admin/purchase/list', r)) {
    console.log(`    total=${r.body.data.total}`);
  }

  // Step 10: 分类管理 CRUD（GET + POST /admin/category）
  console.log('\n[10/10] 分类管理 CRUD');
  r = await apiRequest('GET', '/api/admin/category/list', null, adminToken);
  await resp('GET /admin/category/list', r);

  r = await apiRequest('POST', '/api/admin/category', { name: '冒烟测试分类_' + Date.now(), sort: 99 }, adminToken);
  const catOk = await resp('POST /admin/category', r);
  const catId = r.status === 200 ? r.body.data?.id : null;

  if (catId) {
    r = await apiRequest('PUT', `/api/admin/category/${catId}`, { name: '冒烟测试分类_已更新', sort: 88 }, adminToken);
    await resp('PUT /admin/category/:id', r);
    r = await apiRequest('DELETE', `/api/admin/category/${catId}`, null, adminToken);
    await resp('DELETE /admin/category/:id', r);
  }

  // Step 11: 代理商待审核列表（GET /admin/agent/pending）
  console.log('\n[11] 代理商待审核列表');
  r = await apiRequest('GET', '/api/admin/agent/pending?page=1&page_size=5', null, adminToken);
  await resp('GET /admin/agent/pending', r);

  // Step 12: 代理商升级申请待审核（GET /admin/agent/upgrade/pending）
  console.log('\n[12] 代理商升级申请待审核');
  r = await apiRequest('GET', '/api/admin/agent/upgrade/pending?page=1&page_size=5', null, adminToken);
  await resp('GET /admin/agent/upgrade/pending', r);

  // Step 13: 订单列表（GET /admin/order/list）
  console.log('\n[13] 订单列表');
  r = await apiRequest('GET', '/api/admin/order/list?page=1&page_size=5', null, adminToken);
  if (await resp('GET /admin/order/list', r)) {
    console.log(`    total=${r.body.data.total}`);
  }

  // 无权限验证：普通用户访问管理员接口
  console.log('\n--- 无权限验证（普通用户调用 admin 接口应返回 403）---');
  const userRes = await loginWithRetry('test_user_001', '冒烟普通用户');
  const userToken = userRes.body?.data?.token;
  if (userToken) {
    r = await apiRequest('GET', '/api/admin/stats/overview', null, userToken);
    const noAuth = r.status === 403;
    console.log(`  ${noAuth ? '✓' : '✗'} 普通用户 GET /admin/stats/overview → ${r.status}（期望 403）`);
  }

  // 无 Token 验证
  console.log('\n--- 无 Token 验证（应返回 401）---');
  r = await request('/api/admin/stats/overview');
  const noToken = r.status === 401;
  console.log(`  ${noToken ? '✓' : '✗'} 无 Token GET /admin/stats/overview → ${r.status}（期望 401）`);

  console.log('\n========== 冒烟测试完成 ==========\n');
}

run().catch(err => {
  console.error('测试异常:', err.message);
  process.exit(1);
});
