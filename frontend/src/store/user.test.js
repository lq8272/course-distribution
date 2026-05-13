/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock uni global
const mockUni = {
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
};
global.uni = mockUni;

describe('useUserStore', () => {
  let useUserStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('./user.js');
    useUserStore = mod.useUserStore;
  });

  describe('初始状态', () => {
    it('userInfo初始值从storage读取', () => {
      mockUni.getStorageSync
        .mockReturnValueOnce({ id: 1, name: 'test' }) // userInfo
        .mockReturnValueOnce('token-abc')              // token
        .mockReturnValueOnce('refresh-xyz');           // refreshToken

      const store = useUserStore();
      expect(store.userInfo).toEqual({ id: 1, name: 'test' });
    });

    it('token初始值从storage读取', () => {
      mockUni.getStorageSync
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('my-token')
        .mockReturnValueOnce(null);

      const store = useUserStore();
      expect(store.token).toBe('my-token');
    });

    it('无storage数据时初始为null', () => {
      mockUni.getStorageSync.mockReturnValue(null);

      const store = useUserStore();
      expect(store.userInfo).toBe(null);
      expect(store.token).toBe(null);
      expect(store.refreshToken).toBe(null);
    });
  });

  describe('setAuth', () => {
    it('设置正确的token和userInfo', () => {
      mockUni.getStorageSync.mockReturnValue(null);
      const store = useUserStore();

      const userData = { id: 5, name: 'alice', is_admin: false };
      store.setAuth(userData, 'new-token-xyz', 'refresh-token-abc');

      expect(store.userInfo).toEqual(userData);
      expect(store.token).toBe('new-token-xyz');
      expect(store.refreshToken).toBe('refresh-token-abc');
      expect(mockUni.setStorageSync).toHaveBeenCalledWith('userInfo', userData);
      expect(mockUni.setStorageSync).toHaveBeenCalledWith('token', 'new-token-xyz');
      expect(mockUni.setStorageSync).toHaveBeenCalledWith('refreshToken', 'refresh-token-abc');
    });

    it('setAuth后isLoggedIn为true', () => {
      mockUni.getStorageSync.mockReturnValue(null);
      const store = useUserStore();
      store.setAuth({ id: 1 }, 'token', 'refresh');
      expect(store.isLoggedIn).toBe(true);
    });

    it('setAuth后isAdmin取决于userInfo.is_admin', () => {
      mockUni.getStorageSync.mockReturnValue(null);
      const store = useUserStore();

      store.setAuth({ id: 1, is_admin: true }, 'token', 'refresh');
      expect(store.isAdmin).toBe(true);

      store.setAuth({ id: 2, is_admin: false }, 'token', 'refresh');
      expect(store.isAdmin).toBe(false);
    });
  });

  describe('clearAuth', () => {
    it('清除所有状态', () => {
      mockUni.getStorageSync.mockReturnValue(null);
      const store = useUserStore();
      store.setAuth({ id: 5 }, 'token-abc', 'refresh-xyz');

      store.clearAuth();

      expect(store.userInfo).toBe(null);
      expect(store.token).toBe(null);
      expect(store.refreshToken).toBe(null);
    });

    it('清除后isLoggedIn为false', () => {
      mockUni.getStorageSync.mockReturnValue(null);
      const store = useUserStore();
      store.setAuth({ id: 5 }, 'token', 'refresh');
      store.clearAuth();
      expect(store.isLoggedIn).toBe(false);
    });

    it('清除后isAdmin为false', () => {
      mockUni.getStorageSync.mockReturnValue(null);
      const store = useUserStore();
      store.setAuth({ id: 5, is_admin: true }, 'token', 'refresh');
      store.clearAuth();
      expect(store.isAdmin).toBe(false);
    });

    it('清除后调用removeStorageSync', () => {
      mockUni.getStorageSync.mockReturnValue(null);
      const store = useUserStore();
      store.clearAuth();

      expect(mockUni.removeStorageSync).toHaveBeenCalledWith('userInfo');
      expect(mockUni.removeStorageSync).toHaveBeenCalledWith('token');
      expect(mockUni.removeStorageSync).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('updateUserInfo', () => {
    it('正确合并更新userInfo', () => {
      mockUni.getStorageSync
        .mockReturnValueOnce({ id: 1, name: 'alice', age: 20 })
        .mockReturnValueOnce('token')
        .mockReturnValueOnce(null);

      const store = useUserStore();
      store.updateUserInfo({ age: 21, city: 'beijing' });

      expect(store.userInfo).toEqual({ id: 1, name: 'alice', age: 21, city: 'beijing' });
      expect(mockUni.setStorageSync).toHaveBeenCalledWith('userInfo', store.userInfo);
    });

    it('只传部分字段时保留原有字段', () => {
      mockUni.getStorageSync
        .mockReturnValueOnce({ id: 3, name: 'bob', role: 'user' })
        .mockReturnValueOnce('token')
        .mockReturnValueOnce(null);

      const store = useUserStore();
      store.updateUserInfo({ role: 'admin' });

      expect(store.userInfo).toEqual({ id: 3, name: 'bob', role: 'admin' });
    });

    it('更新后isAdmin同步变化', () => {
      mockUni.getStorageSync
        .mockReturnValueOnce({ id: 1, is_admin: false })
        .mockReturnValueOnce('token')
        .mockReturnValueOnce(null);

      const store = useUserStore();
      expect(store.isAdmin).toBe(false);

      store.updateUserInfo({ is_admin: true });
      expect(store.isAdmin).toBe(true);
    });
  });

  describe('计算属性', () => {
    describe('isLoggedIn', () => {
      it('有token时为true', () => {
        mockUni.getStorageSync.mockReturnValue(null);
        const store = useUserStore();
        store.setAuth({ id: 1 }, 'token', 'refresh');
        expect(store.isLoggedIn).toBe(true);
      });

      it('无token时为false', () => {
        mockUni.getStorageSync.mockReturnValue(null);
        const store = useUserStore();
        store.setAuth(null, null, null);
        expect(store.isLoggedIn).toBe(false);
      });

      it('token为空字符串时为false', () => {
        mockUni.getStorageSync.mockReturnValue(null);
        const store = useUserStore();
        store.setAuth({ id: 1 }, '', '');
        expect(store.isLoggedIn).toBe(false);
      });
    });

    describe('isAdmin', () => {
      it('userInfo.is_admin为true时为true', () => {
        mockUni.getStorageSync.mockReturnValue(null);
        const store = useUserStore();
        store.setAuth({ id: 1, is_admin: true }, 'token', 'refresh');
        expect(store.isAdmin).toBe(true);
      });

      it('userInfo.is_admin为false时为false', () => {
        mockUni.getStorageSync.mockReturnValue(null);
        const store = useUserStore();
        store.setAuth({ id: 1, is_admin: false }, 'token', 'refresh');
        expect(store.isAdmin).toBe(false);
      });

      it('userInfo为null时为false', () => {
        mockUni.getStorageSync.mockReturnValue(null);
        const store = useUserStore();
        store.setAuth(null, null, null);
        expect(store.isAdmin).toBe(false);
      });

      it('userInfo为空对象时为false', () => {
        mockUni.getStorageSync.mockReturnValue(null);
        const store = useUserStore();
        store.setAuth({}, 'token', 'refresh');
        expect(store.isAdmin).toBe(false);
      });
    });
  });
});
