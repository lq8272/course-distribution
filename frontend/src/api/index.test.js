/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock uni global
const mockUni = {
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
  reLaunch: vi.fn(),
  request: vi.fn(),
};
global.uni = mockUni;

// Mock import.meta.env
const originalImportMeta = global.import.meta;
global.import.meta = {
  ...originalImportMeta,
  env: { VITE_API_BASE_URL: 'http://127.0.0.1:3000/api/v1' },
};

// We need to reimport request each test to reset state
vi.resetModules();

describe('API request封装', () => {
  let api;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    global.import.meta.env = { VITE_API_BASE_URL: 'http://127.0.0.1:3000/api/v1' };
    const mod = await import('./index.js');
    api = mod.api;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('api.get / api.post / api.put / api.delete', () => {
    it('GET请求不带token时不应带Authorization头', async () => {
      mockUni.getStorageSync.mockReturnValue(null);
      mockUni.request.mockImplementation((options) => {
        options.success({ statusCode: 200, data: { code: 0, data: { list: [] } } });
      });

      await api.get('/test');

      expect(mockUni.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          header: expect.not.objectContaining({ Authorization: expect.any(String) }),
        })
      );
    });

    it('GET请求带token时应带Authorization头', async () => {
      mockUni.getStorageSync.mockReturnValue('test-token-abc');
      mockUni.request.mockImplementation((options) => {
        options.success({ statusCode: 200, data: { code: 0, data: { list: [] } } });
      });

      await api.get('/test');

      expect(mockUni.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          header: expect.objectContaining({ Authorization: 'Bearer test-token-abc' }),
        })
      );
    });

    it('POST请求能正确发送data', async () => {
      mockUni.getStorageSync.mockReturnValue('test-token');
      mockUni.request.mockImplementation((options) => {
        options.success({ statusCode: 200, data: { code: 0, data: { id: 1 } } });
      });

      await api.post('/create', { name: 'test' });

      expect(mockUni.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: { name: 'test' },
        })
      );
    });
  });

  describe('request 成功响应解析', () => {
    it('code=0时返回res.data.data', async () => {
      mockUni.getStorageSync.mockReturnValue('token');
      mockUni.request.mockImplementation((options) => {
        options.success({ statusCode: 200, data: { code: 0, data: { foo: 'bar' } } });
      });

      const result = await api.get('/user/info');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('非200状态码或code!=0时reject', async () => {
      mockUni.getStorageSync.mockReturnValue('token');
      mockUni.request.mockImplementation((options) => {
        options.success({ statusCode: 400, data: { code: 400, message: '参数错误' } });
      });

      await expect(api.get('/user/info')).rejects.toEqual({ code: 400, message: '参数错误' });
      expect(mockUni.showToast).toHaveBeenCalledWith({ title: '参数错误', icon: 'none' });
    });
  });

  describe('401 自动跳转登录页', () => {
    it('状态码401时清除token并跳转登录页', async () => {
      mockUni.getStorageSync.mockReturnValue('expired-token');
      mockUni.request.mockImplementation((options) => {
        options.success({ statusCode: 401, data: { code: 401, message: '登录已过期' } });
      });

      await expect(api.get('/user/info')).rejects.toBeDefined();
      expect(mockUni.removeStorageSync).toHaveBeenCalledWith('token');
      expect(mockUni.showToast).toHaveBeenCalledWith({ title: '登录已过期', icon: 'none' });
      expect(mockUni.reLaunch).toHaveBeenCalledWith({ url: '/pages/login/index' });
    });

    it('401时即使已有token也清除', async () => {
      mockUni.getStorageSync.mockReturnValue('some-token');
      mockUni.request.mockImplementation((options) => {
        options.success({ statusCode: 401, data: { code: 401, message: '请重新登录' } });
      });

      await expect(api.get('/test')).rejects.toBeDefined();
      expect(mockUni.removeStorageSync).toHaveBeenCalledWith('token');
    });
  });

  describe('超时处理', () => {
    it('10秒超时后reject并提示请求超时', async () => {
      vi.useFakeTimers();
      mockUni.getStorageSync.mockReturnValue('token');
      mockUni.request.mockImplementation(() => {}); // never calls success/fail

      const promise = api.get('/slow');
      vi.advanceTimersByTime(10000);
      await expect(promise).rejects.toThrow('请求超时');
      expect(mockUni.showToast).toHaveBeenCalledWith({ title: '请求超时，请稍后重试', icon: 'none' });
    });

    it('超时后不会再处理响应', async () => {
      vi.useFakeTimers();
      mockUni.getStorageSync.mockReturnValue('token');
      let calledAfterTimeout = false;
      mockUni.request.mockImplementation((options) => {
        setTimeout(() => {
          if (!calledAfterTimeout) {
            calledAfterTimeout = true;
            options.success({ statusCode: 200, data: { code: 0, data: {} } });
          }
        }, 500);
      });

      const promise = api.get('/test');
      vi.advanceTimersByTime(10000);
      await expect(promise).rejects.toThrow('请求超时');

      // Give time for the setTimeout to fire
      await new Promise(r => setTimeout(r, 600));

      // Should not have resolved with the late response
      // (the promise already rejected)
    });
  });

  describe('无token时不带Authorization', () => {
    it('storage中无token时header不含Authorization', async () => {
      mockUni.getStorageSync.mockReturnValue(null);
      mockUni.request.mockImplementation((options) => {
        options.success({ statusCode: 200, data: { code: 0, data: {} } });
      });

      await api.post('/public', { foo: 'bar' });

      const call = mockUni.request.mock.calls[0][0];
      expect(call.header).not.toHaveProperty('Authorization');
    });

    it('空字符串token也不应带Authorization', async () => {
      mockUni.getStorageSync.mockReturnValue('');
      mockUni.request.mockImplementation((options) => {
        options.success({ statusCode: 200, data: { code: 0, data: {} } });
      });

      await api.get('/test');
      const call = mockUni.request.mock.calls[0][0];
      expect(call.header).not.toHaveProperty('Authorization');
    });
  });

  describe('fail回调处理', () => {
    it('网络错误时reject并提示', async () => {
      mockUni.getStorageSync.mockReturnValue('token');
      mockUni.request.mockImplementation((options) => {
        options.fail({ errMsg: 'network error' });
      });

      await expect(api.get('/test')).rejects.toEqual({ errMsg: 'network error' });
      expect(mockUni.showToast).toHaveBeenCalledWith({ title: '网络错误，请检查网络连接', icon: 'none' });
    });
  });
});
