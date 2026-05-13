/**
 * 测试工具：纯 HTTP 请求封装
 * 直接请求运行中的服务器，不导入 Express app（避免端口占用）
 * 所有请求自动带上 ?__test_bypass=1 绕过登录限流（WSL 主机通过 Docker 端口映射时 header 会被丢弃）
 */
const http = require('http');

const API_BASE = process.env.TEST_API || 'http://localhost:3000/api/v1';

/**
 * 发送 HTTP 请求
 * @param {string} path - API 路径（不含 /api 前缀）
 * @param {object} options
 * @param {string} options.method - HTTP 方法
 * @param {object} options.body - 请求体
 * @param {string} options.token - 自动注入 Authorization header
 */
/**
 * 发送 HTTP 请求（带自动重试：限流 429 时等待 2s 后重试，最多 3 次）
 * @param {string} path - API 路径（不含 /api 前缀）
 * @param {object} options
 * @param {string} options.method - HTTP 方法
 * @param {object} options.body - 请求体
 * @param {string} options.token - 自动注入 Authorization header
 */
function request(path, options = {}) {
  const { method = 'GET', body = null, token = null } = options;

  return new Promise((resolve, reject) => {
    // 追加测试 bypass query 参数（端口映射时 header 会被丢弃，query 参数可靠）
    const bypassPath = path.includes('?')
      ? `${path}&__test_bypass=1`
      : `${path}?__test_bypass=1`;
    const baseUrl = new URL(API_BASE);
    const basePath = baseUrl.pathname; // e.g. '/api/v1'
    let fullPath;
    if (bypassPath.startsWith('http://') || bypassPath.startsWith('https://')) {
      fullPath = bypassPath;
    } else if (bypassPath.startsWith('/api/')) {
      // 绝对路径如 /api/... → 替换 /api/ 为 basePath
      // 使 /api/course/list → /api/v1/course/list
      fullPath = basePath + bypassPath.slice(4); // basePath + '/course/list'
    } else if (bypassPath.startsWith('/')) {
      fullPath = `${basePath}${bypassPath}`;
    } else {
      fullPath = `${basePath}/${bypassPath}`;
    }
    const url = new URL(fullPath, `${baseUrl.origin}`);
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const doRequest = (attempt = 1) => {
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers,
      };

      const req = http.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            // 限流触发：等待 2 秒后重试（最多 3 次）
            if (res.statusCode === 429 && attempt < 3) {
              console.warn(`[setup] 限流触发(429)，${attempt}/3，等待 2s 后重试...`);
              setTimeout(() => doRequest(attempt + 1), 2000);
              return;
            }
            resolve({ status: res.statusCode, body: parsed });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    };

    doRequest();
  });
}

/** 带 Token 的快捷请求 */
function apiRequest(method, path, body, token) {
  return request(path, { method, body, token });
}

/**
 * 带重试的登录请求（限流 429 时自动等 2s 重试，最多 3 次）
 */
async function loginWithRetry(code, nickname) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await apiRequest('POST', '/api/auth/login', { code, nickname });
    if (res.status === 200 && res.body.data?.token) {
      return res;
    }
    if (res.status === 429 && attempt < maxAttempts) {
      console.warn(`[setup] 登录 ${code} 触发限流(429)，${attempt}/${maxAttempts}，等待 2s 后重试...`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }
    return res;
  }
}

module.exports = { request, apiRequest, API_BASE, loginWithRetry };
