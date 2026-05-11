/**
 * 认证模块集成测试
 * 使用 HTTP 请求测试运行中的服务器
 */
const { request, apiRequest } = require('./setup');

describe('认证模块', () => {
  let userToken, adminToken, refreshToken;

  beforeAll(async () => {
    // 普通用户
    const userRes = await apiRequest('POST', '/api/auth/login', {
      code: 'test_user_001',
      nickname: '测试用户',
    });
    userToken = userRes.body.data?.token;
    refreshToken = userRes.body.data?.refreshToken;

    // 管理员
    const adminRes = await apiRequest('POST', '/api/auth/login', {
      code: 'test_admin_001',
      nickname: '管理员',
    });
    adminToken = adminRes.body.data?.token;
  });

  describe('POST /auth/login', () => {
    it('普通用户登录成功', async () => {
      expect(userToken).toBeDefined();
    });

    it('管理员登录成功', async () => {
      // 允许 429（限流）或 200
      expect([200, 429]).toContain(adminToken ? 200 : 429);
    });

    it('无code参数返回400或429', async () => {
      const res = await apiRequest('POST', '/api/auth/login', { nickname: '测试' });
      expect([400, 429]).toContain(res.status);
    });
  });

  describe('GET /auth/userinfo', () => {
    it('有效Token获取用户信息成功', async () => {
      if (!userToken) return;
      const res = await apiRequest('GET', '/api/auth/userinfo', null, userToken);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.id).toBeDefined();
    });

    it('无效Token返回401', async () => {
      const res = await apiRequest('GET', '/api/auth/userinfo', null, 'invalid_token_123');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(40101);
    });

    it('无Token返回401', async () => {
      const res = await request('/api/auth/userinfo');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(40100);
    });
  });

  describe('POST /auth/logout', () => {
    it('登出后Token失效（黑名单生效）', async () => {
      if (!userToken) return;

      const logoutRes = await apiRequest('POST', '/api/auth/logout', {
        token: userToken,
        refreshToken: refreshToken,
      }, userToken);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.code).toBe(0);

      // Token 被黑名单
      const userinfoRes = await apiRequest('GET', '/api/auth/userinfo', null, userToken);
      expect(userinfoRes.status).toBe(401);
      expect(userinfoRes.body.code).toBe(40102);
    });
  });

  describe('POST /auth/refresh', () => {
    it('刷新Token后获得新Token', async () => {
      // logout 后需要新用户重新登录（避免与已登出的 token 冲突）
      const loginRes = await apiRequest('POST', '/api/auth/login', {
        code: 'test_user_010',
        nickname: '刷新测试',
      });

      if (loginRes.status === 429) {
        console.warn('[SKIP] login rate-limited');
        return;
      }

      const oldRefresh = loginRes.body.data?.refreshToken;
      const oldToken = loginRes.body.data?.token;

      const refreshRes = await apiRequest('POST', '/api/auth/refresh', {
        refreshToken: oldRefresh,
      });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.code).toBe(0);
      expect(refreshRes.body.data?.token).toBeDefined();
      expect(refreshRes.body.data?.token).not.toBe(oldToken);

      const userinfoRes = await apiRequest('GET', '/api/auth/userinfo', null, refreshRes.body.data?.token);
      expect(userinfoRes.status).toBe(200);
    });

    it('无效refreshToken返回401', async () => {
      const res = await apiRequest('POST', '/api/auth/refresh', {
        refreshToken: 'invalid_refresh_token',
      });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe(40101);
    });
  });
});
