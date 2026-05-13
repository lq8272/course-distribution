/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock uni global
const mockUni = {
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  connectSocket: vi.fn(),
  $emit: vi.fn(),
};
global.uni = mockUni;

// Mock timers
vi.useFakeTimers();

// Import after mock setup
/** @type {import('./ws.js').wsManager} */
let wsManager;

beforeEach(async () => {
  vi.clearAllMocks();
  // Reset module to get fresh instance
  vi.resetModules();
  const mod = await import('./ws.js');
  wsManager = mod.wsManager;
  // Reset internal state via disconnect
  wsManager.disconnect();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('wsManager', () => {
  describe('connect()', () => {
    it('should not connect when no token exists', () => {
      mockUni.getStorageSync.mockReturnValue(null);
      wsManager.connect();
      expect(mockUni.connectSocket).not.toHaveBeenCalled();
    });

    it('should connect when token exists', () => {
      mockUni.getStorageSync.mockReturnValue('test-token-123');
      const mockSocket = {
        close: vi.fn(),
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      };
      mockUni.connectSocket.mockReturnValue(mockSocket);

      wsManager.connect();

      expect(mockUni.connectSocket).toHaveBeenCalledWith({
        url: 'ws://127.0.0.1:3000/ws?token=test-token-123',
        success: expect.any(Function),
        fail: expect.any(Function),
      });
    });

    it('should close existing socket before reconnecting', () => {
      mockUni.getStorageSync.mockReturnValue('test-token-123');
      const oldSocket = {
        close: vi.fn(),
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      };
      const newSocket = { ...oldSocket };
      mockUni.connectSocket
        .mockReturnValueOnce(oldSocket)
        .mockReturnValueOnce(newSocket);

      wsManager.connect();
      wsManager.connect(); // reconnect

      expect(oldSocket.close).toHaveBeenCalled();
    });
  });

  describe('send()', () => {
    it('should return false when not connected', () => {
      const result = wsManager.send('test_event', { foo: 'bar' });
      expect(result).toBe(false);
    });

    it('should send JSON payload when connected', () => {
      mockUni.getStorageSync.mockReturnValue('test-token-123');
      const mockSocket = {
        close: vi.fn(),
        send: vi.fn(),
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      };
      mockUni.connectSocket.mockReturnValue(mockSocket);

      wsManager.connect();
      // Simulate open
      mockSocket.onOpen();

      const result = wsManager.send('customer_message', { text: 'hello' });

      expect(result).toBe(true);
      expect(mockSocket.send).toHaveBeenCalledWith({
        data: JSON.stringify({ event: 'customer_message', text: 'hello' }),
      });
    });
  });

  describe('disconnect()', () => {
    it('should clear state and close socket', () => {
      mockUni.getStorageSync.mockReturnValue('test-token-123');
      const mockSocket = {
        close: vi.fn(),
        send: vi.fn(),
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      };
      mockUni.connectSocket.mockReturnValue(mockSocket);

      wsManager.connect();
      mockSocket.onOpen();
      wsManager.disconnect();

      expect(wsManager.connected).toBe(false);
      expect(mockSocket.close).toHaveBeenCalled();
    });
  });

  describe('message dispatching', () => {
    it('should emit ws_customer_message on customer_message event', () => {
      mockUni.getStorageSync.mockReturnValue('test-token-123');
      const mockSocket = {
        close: vi.fn(),
        send: vi.fn(),
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      };
      mockUni.connectSocket.mockReturnValue(mockSocket);

      wsManager.connect();
      mockSocket.onOpen();

      const msg = { event: 'customer_message', data: { id: 1, text: 'hi' } };
      mockSocket.onMessage({ data: JSON.stringify(msg) });

      expect(mockUni.$emit).toHaveBeenCalledWith('ws_customer_message', { id: 1, text: 'hi' });
    });

    it('should emit ws_admin_reply on admin_reply event', () => {
      mockUni.getStorageSync.mockReturnValue('test-token-123');
      const mockSocket = {
        close: vi.fn(),
        send: vi.fn(),
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      };
      mockUni.connectSocket.mockReturnValue(mockSocket);

      wsManager.connect();
      mockSocket.onOpen();

      const msg = { event: 'admin_reply', data: { reply: 'welcome' } };
      mockSocket.onMessage({ data: JSON.stringify(msg) });

      expect(mockUni.$emit).toHaveBeenCalledWith('ws_admin_reply', { reply: 'welcome' });
    });

    it('should handle pong event', () => {
      mockUni.getStorageSync.mockReturnValue('test-token-123');
      const mockSocket = {
        close: vi.fn(),
        send: vi.fn(),
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      };
      mockUni.connectSocket.mockReturnValue(mockSocket);

      wsManager.connect();
      mockSocket.onOpen();

      const before = wsManager.lastPongAt;
      const msg = { event: 'pong' };
      mockSocket.onMessage({ data: JSON.stringify(msg) });

      expect(wsManager.lastPongAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('reconnect logic', () => {
    it('should schedule reconnect on socket close', () => {
      mockUni.getStorageSync.mockReturnValue('test-token-123');
      const mockSocket = {
        close: vi.fn(),
        send: vi.fn(),
        onOpen: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
      };
      mockUni.connectSocket.mockReturnValue(mockSocket);

      wsManager.connect();
      mockSocket.onOpen();
      mockSocket.onClose();

      // Advance timer by 3 seconds
      vi.advanceTimersByTime(3000);

      // Should have attempted reconnect
      expect(mockUni.connectSocket).toHaveBeenCalledTimes(2);
    });
  });
});
