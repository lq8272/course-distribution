/**
 * E2E 测试工具函数
 * 所有 API 绕过 nginx 直接调用后端（http://localhost:3000/api/v1）
 * 登录态通过 page.addInitScript 注入到 localStorage
 */
import http from 'http';
const API = 'http://localhost:3000/api/v1';

/**
 * 调用后端 API（Node.js 端，不走浏览器）
 * @param {string} path  - API 路径，如 /auth/login
 * @param {object} options
 */
async function apiCall(path, options = {}) {
  const { method = 'GET', body = null, token = null } = options;
  const bypassPath = path.includes('?')
    ? `${path}&__test_bypass=1`
    : `${path}?__test_bypass=1`;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = new URL(`${API}${bypassPath}`);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method: method.toUpperCase(), headers },
      (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 用户登录（test_ 前缀模式），注入 token 到 localStorage
 * @param {import('@playwright/test').Page} page
 * @param {string} code  - 微信 code，test_ 前缀会绕过真实微信调用
 * @param {string} [nickname]
 * @param {string} [promotionCode]
 */
export async function loginAsUser(page, code, nickname = null, promotionCode = null) {
  const body = { code, nickname: nickname || `E2E_${code}` };
  if (promotionCode) body.promotion_code = promotionCode;

  const res = await apiCall('/auth/login', { method: 'POST', body });
  if (res.code !== 0 || !res.data?.token) {
    throw new Error(`loginAsUser failed: ${JSON.stringify(res)}`);
  }
  const { token, refreshToken, user } = res.data;

  await page.addInitScript(({ token: t, refreshToken: rt, user: u }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('refreshToken', rt);
    localStorage.setItem('userInfo', JSON.stringify(u));
  }, { token, refreshToken, user });

  return res.data;
}

/**
 * 管理员账号登录，注入 token 到 localStorage
 * @param {import('@playwright/test').Page} page
 * @param {string} [username]
 * @param {string} [password]
 */
export async function loginAsAdmin(page, username = '13800138000', password = 'admin123') {
  const res = await apiCall('/admin/login', { method: 'POST', body: { username, password } });
  if (res.code !== 0 || !res.data?.token) {
    throw new Error(`loginAsAdmin failed: ${JSON.stringify(res)}`);
  }
  const { token, user } = res.data;

  await page.addInitScript(({ token: t, user: u }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('refreshToken', '');
    localStorage.setItem('userInfo', JSON.stringify(u));
  }, { token, user });

  return res.data;
}

/**
 * 清除 localStorage 中的登录态
 * @param {import('@playwright/test').Page} page
 */
export async function logout(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');
  });
}

/**
 * 通过 API 创建订单（page.evaluate 调浏览器内 fetch）
 * 返回 orderId
 * @param {import('@playwright/test').Page} page
 * @param {number} courseId
 * @param {string} [promotionCode]
 * @returns {Promise<number>} orderId
 */
export async function createOrderWithCourse(page, courseId, promotionCode = null) {
  return page.evaluate(async ({ courseId: cid, promotionCode: pc }) => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/api/v1/order/create?__test_bypass=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ course_id: cid, promotion_code: pc }),
    });
    const json = await res.json();
    if (json.code !== 0) throw new Error(`createOrderWithCourse failed: ${JSON.stringify(json)}`);
    return json.data.order_id;
  }, { courseId, promotionCode });
}

/**
 * 通过 Node.js 端 API 调用创建订单（不依赖浏览器）
 * @param {string} token
 * @param {number} courseId
 * @param {string} [promotionCode]
 * @returns {Promise<number>} orderId
 */
export async function createOrderWithCourseNode(token, courseId, promotionCode = null) {
  const body = { course_id: courseId };
  if (promotionCode) body.promotion_code = promotionCode;
  const res = await apiCall('/order/create', { method: 'POST', body, token });
  if (res.code !== 0) throw new Error(`createOrderNode failed: ${JSON.stringify(res)}`);
  return res.data.order_id;
}

/**
 * 管理员确认订单（Node.js 端调用）
 * @param {string} adminToken
 * @param {number} orderId
 */
export async function confirmOrder(adminToken, orderId) {
  const res = await apiCall(`/admin/order/${orderId}/confirm`, { method: 'POST', token: adminToken });
  if (res.code !== 0) throw new Error(`confirmOrder failed: ${JSON.stringify(res)}`);
  return res;
}

/**
 * 用户发起佣金提现申请（Node.js 端调用）
 * @param {string} token
 * @param {number} amount
 */
export async function applyWithdraw(token, amount) {
  const res = await apiCall('/commission/withdraw', { method: 'POST', body: { amount }, token });
  if (res.code !== 0) throw new Error(`applyWithdraw failed: ${JSON.stringify(res)}`);
  return res;
}

/**
 * 管理员审核通过提现（Node.js 端调用）
 * @param {string} adminToken
 * @param {number} withdrawId
 */
export async function approveWithdraw(adminToken, withdrawId) {
  const res = await apiCall(`/admin/withdraw/${withdrawId}/approve`, { method: 'POST', token: adminToken });
  if (res.code !== 0) throw new Error(`approveWithdraw failed: ${JSON.stringify(res)}`);
  return res;
}

/**
 * 获取用户可提现佣金余额（Node.js 端）
 * @param {string} token
 */
export async function getCommissionStats(token) {
  const res = await apiCall('/commission/stats', { token });
  if (res.code !== 0) throw new Error(`getCommissionStats failed: ${JSON.stringify(res)}`);
  return res.data;
}
