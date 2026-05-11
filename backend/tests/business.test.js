/**
 * 业务模块集成测试
 * 使用 HTTP 请求测试运行中的服务器
 */
const { request, apiRequest, loginWithRetry } = require('./setup');

describe('业务模块', () => {
  let userToken, adminToken, userId, courseId;

  beforeAll(async () => {
    // 使用 loginWithRetry 确保拿到 token（限流 bypass 已启用）
    const userRes = await loginWithRetry('test_user_100', '业务测试用户');
    userToken = userRes?.body?.data?.token;
    userId = userRes?.body?.data?.user?.id;

    const adminRes = await loginWithRetry('test_admin_001', '业务测试管理员');
    adminToken = adminRes?.body?.data?.token;
  });

  // ==========================================
  // 课程模块
  // ==========================================
  describe('课程模块', () => {
    it('GET /course/list - 获取课程列表（公开）', async () => {
      const res = await request('/api/course/list');

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data.list)).toBe(true);
      expect(typeof res.body.data.total).toBe('number');
      courseId = res.body.data.list[0]?.id;
    });

    it('GET /course/categories - 获取分类列表（公开）', async () => {
      const res = await request('/api/course/categories');

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /course/detail/:id - 获取课程详情（公开）', async () => {
      if (!courseId) return;

      const res = await request(`/api/course/detail/${courseId}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.id).toBe(courseId);
      expect(res.body.data.title).toBeDefined();
    });

    it('POST /course/create - 认证用户创建课程（需分销权限）', async () => {
      if (!userToken) return;
      const res = await apiRequest('POST', '/api/course/create', {
        title: '测试课程_' + Date.now(),
        description: '自动化测试创建的课程',
        price: 99,
        cover_url: 'https://example.com/cover.jpg',
        video_url: 'https://example.com/video.mp4',
        category: '测试分类',
      }, userToken);

      // 有分销权限才可创建，否则403
      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.code).toBe(0);
        expect(res.body.data.id).toBeDefined();
      }
    });

    it('GET /admin/course/list - 管理员获取课程列表', async () => {
      if (!adminToken) return;
      const res = await apiRequest('GET', '/api/admin/course/list', null, adminToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data.list)).toBe(true);
      expect(typeof res.body.data.total).toBe('number');
    });

    it('POST /admin/course/create - 管理员创建课程', async () => {
      if (!adminToken) return;
      const res = await apiRequest('POST', '/api/admin/course/create', {
        title: '管理员测试课程_' + Date.now(),
        description: '自动化测试创建',
        price: 199,
        cover_image: 'https://example.com/cover.jpg',
        video_key: 'test/video.mp4',
        category_id: 1,
      }, adminToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.id).toBeDefined();
    });
  });

  // ==========================================
  // 订单模块
  // ==========================================
  describe('订单模块', () => {
    it('POST /order/create - 创建订单', async () => {
      if (!courseId || !userToken) return;

      const res = await apiRequest('POST', '/api/order/create', {
        course_id: courseId,
        paymentMethod: 'wechat',
      }, userToken);

      // 正常创建(200) OR 已购买(400+ALREADY_PURCHASED)
      expect([200, 400]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.code).toBe(0);
        expect(res.body.data.order_id).toBeDefined();
      }
    });

    it('POST /order/create - 无效课程ID返回错误', async () => {
      if (!userToken) return;
      const res = await apiRequest('POST', '/api/order/create', {
        course_id: 999999,
        paymentMethod: 'wechat',
      }, userToken);

      expect([400, 404]).toContain(res.status);
    });

    it('GET /order/my - 获取当前用户订单列表', async () => {
      if (!userToken) return;
      const res = await apiRequest('GET', '/api/order/my', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('rows');
      expect(Array.isArray(res.body.data.rows)).toBe(true);
    });

    it('GET /order/list - 管理员获取订单列表', async () => {
      if (!adminToken) return;
      const res = await apiRequest('GET', '/api/order/list', null, adminToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
    });
  });

  // ==========================================
  // 佣金模块
  // ==========================================
  describe('佣金模块', () => {
    it('GET /commission/list - 获取佣金记录', async () => {
      if (!userToken) return;
      const res = await apiRequest('GET', '/api/commission/list', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('rows');
    });

    it('GET /commission/stats - 获取佣金汇总', async () => {
      if (!userToken) return;
      const res = await apiRequest('GET', '/api/commission/stats', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('available');
    });
  });

  // ==========================================
  // 团队模块
  // ==========================================
  describe('团队模块', () => {
    it('GET /team/overview - 获取团队信息', async () => {
      if (!userToken) return;

      const res = await apiRequest('GET', '/api/team/overview', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('is_agent');
      if (res.body.data.is_agent) {
        expect(res.body.data).toHaveProperty('stats');
      }
    });

    it('GET /team/tree - 获取团队成员列表', async () => {
      if (!userToken) return;

      const res = await apiRequest('GET', '/api/team/tree', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      if (res.body.data.list) {
        expect(Array.isArray(res.body.data.list)).toBe(true);
      } else {
        expect(res.body.data).toHaveProperty('is_agent');
      }
    });
  });

  // ==========================================
  // 客服模块
  // ==========================================
  describe('客服模块', () => {
    it('GET /service/conversations - 获取会话列表', async () => {
      if (!userToken) return;
      const res = await apiRequest('GET', '/api/service/conversations', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /service/conversations - 创建会话/提交反馈', async () => {
      if (!userToken) return;
      const res = await apiRequest('POST', '/api/service/conversations', {
        type: 'feedback',
        content: '自动化测试反馈内容_' + Date.now(),
        contact: 'test@example.com',
      }, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
    });
  });

  // ==========================================
  // 通知模块
  // ==========================================
  describe('通知模块', () => {
    it('GET /notifications - 获取通知列表', async () => {
      if (!userToken) return;
      const res = await apiRequest('GET', '/api/notifications', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('rows');
      expect(Array.isArray(res.body.data.rows)).toBe(true);
    });

    it('PUT /notifications/:id/read - 标记单条通知已读', async () => {
      if (!userToken) return;
      const listRes = await apiRequest('GET', '/api/notifications', null, userToken);
      const notifications = listRes.body.data?.list || [];
      if (notifications.length === 0) return;

      const firstId = notifications[0].id || notifications[0].notification_id;
      if (!firstId) return;

      const res = await apiRequest('PUT', `/api/notifications/${firstId}/read`, null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
    });

    it('PUT /notifications/read-all - 全部标记已读', async () => {
      if (!userToken) return;
      const res = await apiRequest('PUT', '/api/notifications/read-all', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
    });

    it('GET /notifications/unread-count - 获取未读数量', async () => {
      if (!userToken) return;
      const res = await apiRequest('GET', '/api/notifications/unread-count', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(typeof res.body.data.count).toBe('number');
    });
  });

  // ==========================================
  // 管理后台
  // ==========================================
  describe('管理后台', () => {
    it('GET /admin/user/stats - 用户统计', async () => {
      if (!adminToken) return;
      const res = await apiRequest('GET', '/api/admin/user/stats', null, adminToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('total');
    });

    it('GET /admin/user/list - 用户列表', async () => {
      if (!adminToken) return;
      const res = await apiRequest('GET', '/api/admin/user/list', null, adminToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
    });

    it('GET /admin/order/list - 订单列表', async () => {
      if (!adminToken) return;
      const res = await apiRequest('GET', '/api/admin/order/list', null, adminToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
    });

    it('GET /admin/agent/pending - 待审核分销商', async () => {
      if (!adminToken) return;
      const res = await apiRequest('GET', '/api/admin/agent/pending', null, adminToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('rows');
      expect(Array.isArray(res.body.data.rows)).toBe(true);
    });
  });

  // ==========================================
  // 用户模块
  // ==========================================
  describe('用户模块', () => {
    it('GET /user/profile - 获取个人资料', async () => {
      if (!userToken) return;
      const res = await apiRequest('GET', '/api/user/profile', null, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data.id).toBe(userId);
    });

    it('PUT /user/profile - 更新个人资料', async () => {
      if (!userToken) return;
      const res = await apiRequest('PUT', '/api/user/profile', {
        nickname: '更新后的昵称_' + Date.now(),
      }, userToken);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
    });
  });

  // ==========================================
  // 健康检查
  // ==========================================
  describe('健康检查', () => {
    it('GET /health - 服务健康状态', async () => {
      const res = await request('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.mysql).toBe('ok');
      expect(res.body.redis).toBe('ok');
    });
  });
});
