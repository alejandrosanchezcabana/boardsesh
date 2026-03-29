import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock window.Capacitor before importing the adapter
const mockBlePlugin = {
  initialize: vi.fn().mockResolvedValue(undefined),
  isEnabled: vi.fn().mockResolvedValue({ value: true }),
  requestDevice: vi.fn().mockResolvedValue({ deviceId: 'dev-1', name: 'Kilter Board' }),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  write: vi.fn().mockResolvedValue(undefined),
  requestMtu: vi.fn().mockResolvedValue({ value: 185 }),
};

// Store original window.Capacitor so we can clean up
const originalCapacitor = (globalThis.window as Record<string, unknown>)?.Capacitor;

Object.defineProperty(globalThis.window ?? globalThis, 'Capacitor', {
  value: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    Plugins: {
      BluetoothLe: mockBlePlugin,
    },
  },
  writable: true,
  configurable: true,
});

afterAll(() => {
  if (originalCapacitor === undefined) {
    delete (globalThis.window as Record<string, unknown>).Capacitor;
  } else {
    (globalThis.window as Record<string, unknown>).Capacitor = originalCapacitor;
  }
});

import { CapacitorBleAdapter } from '../capacitor-adapter';

describe('CapacitorBleAdapter', () => {
  let adapter: CapacitorBleAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new CapacitorBleAdapter();
  });

  describe('isAvailable', () => {
    it('returns true when BLE is enabled', async () => {
      expect(await adapter.isAvailable()).toBe(true);
      expect(mockBlePlugin.initialize).toHaveBeenCalled();
      expect(mockBlePlugin.isEnabled).toHaveBeenCalled();
    });

    it('returns false when BLE is disabled', async () => {
      mockBlePlugin.isEnabled.mockResolvedValueOnce({ value: false });
      expect(await adapter.isAvailable()).toBe(false);
    });

    it('returns false when initialize throws', async () => {
      mockBlePlugin.initialize.mockRejectedValueOnce(new Error('No BLE'));
      expect(await adapter.isAvailable()).toBe(false);
    });
  });

  describe('requestAndConnect', () => {
    it('connects and returns device info', async () => {
      const connection = await adapter.requestAndConnect();

      expect(connection.deviceId).toBe('dev-1');
      expect(connection.deviceName).toBe('Kilter Board');
      expect(mockBlePlugin.initialize).toHaveBeenCalled();
      expect(mockBlePlugin.requestDevice).toHaveBeenCalledWith({
        services: ['4488b571-7806-4df6-bcff-a2897e4953ff'],
        optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'],
      });
      expect(mockBlePlugin.connect).toHaveBeenCalledWith({
        deviceId: 'dev-1',
        onDisconnect: expect.any(Function),
      });
    });

    it('negotiates MTU after connecting', async () => {
      await adapter.requestAndConnect();

      expect(mockBlePlugin.requestMtu).toHaveBeenCalledWith({
        deviceId: 'dev-1',
        mtu: 512,
      });
    });

    it('falls back to default MTU when negotiation fails', async () => {
      mockBlePlugin.requestMtu.mockRejectedValueOnce(new Error('Not supported'));
      await adapter.requestAndConnect();

      // Should still connect successfully — write with default 20-byte chunks
      const data = new Uint8Array(40);
      await adapter.write(data);

      // 40 bytes / 20 byte chunks = 2 writes
      expect(mockBlePlugin.write).toHaveBeenCalledTimes(2);
    });

    it('invokes disconnect callback when device disconnects', async () => {
      const onDisconnect = vi.fn();
      adapter.onDisconnect(onDisconnect);

      await adapter.requestAndConnect();

      // Simulate the native disconnect callback
      const connectCall = mockBlePlugin.connect.mock.calls[0][0];
      connectCall.onDisconnect();

      expect(onDisconnect).toHaveBeenCalledOnce();
    });
  });

  describe('disconnect', () => {
    it('disconnects from connected device', async () => {
      await adapter.requestAndConnect();
      await adapter.disconnect();

      expect(mockBlePlugin.disconnect).toHaveBeenCalledWith({ deviceId: 'dev-1' });
    });

    it('does nothing when not connected', async () => {
      await adapter.disconnect();
      expect(mockBlePlugin.disconnect).not.toHaveBeenCalled();
    });

    it('ignores errors from plugin disconnect', async () => {
      await adapter.requestAndConnect();
      mockBlePlugin.disconnect.mockRejectedValueOnce(new Error('Already disconnected'));

      // Should not throw
      await adapter.disconnect();
    });
  });

  describe('write', () => {
    it('throws when not connected', async () => {
      await expect(adapter.write(new Uint8Array([1, 2, 3]))).rejects.toThrow('Not connected');
    });

    it('writes small data in a single chunk', async () => {
      mockBlePlugin.requestMtu.mockResolvedValueOnce({ value: 185 });
      await adapter.requestAndConnect();

      const data = new Uint8Array([1, 2, 3, 4, 5]);
      await adapter.write(data);

      expect(mockBlePlugin.write).toHaveBeenCalledTimes(1);
      expect(mockBlePlugin.write).toHaveBeenCalledWith({
        deviceId: 'dev-1',
        service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        characteristic: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
        value: expect.any(DataView),
      });
    });

    it('chunks data based on negotiated MTU', async () => {
      // MTU 185 → chunk size 182 (185 - 3 ATT header)
      mockBlePlugin.requestMtu.mockResolvedValueOnce({ value: 185 });
      await adapter.requestAndConnect();

      // 400 bytes / 182 byte chunks = 3 writes (182 + 182 + 36)
      const data = new Uint8Array(400);
      await adapter.write(data);

      expect(mockBlePlugin.write).toHaveBeenCalledTimes(3);
    });

    it('chunks at default 20 bytes when MTU negotiation fails', async () => {
      mockBlePlugin.requestMtu.mockRejectedValueOnce(new Error('Not supported'));
      await adapter.requestAndConnect();

      // 50 bytes / 20 byte chunks = 3 writes (20 + 20 + 10)
      const data = new Uint8Array(50);
      await adapter.write(data);

      expect(mockBlePlugin.write).toHaveBeenCalledTimes(3);
    });

    it('converts Uint8Array chunks to DataView', async () => {
      await adapter.requestAndConnect();

      const data = new Uint8Array([0x01, 0x02, 0x03]);
      await adapter.write(data);

      const writtenValue = mockBlePlugin.write.mock.calls[0][0].value;
      expect(writtenValue).toBeInstanceOf(DataView);
      expect(new Uint8Array(writtenValue.buffer, writtenValue.byteOffset, writtenValue.byteLength)).toEqual(
        new Uint8Array([0x01, 0x02, 0x03]),
      );
    });
  });

  describe('onDisconnect', () => {
    it('returns an unsubscribe function', async () => {
      const callback = vi.fn();
      const unsub = adapter.onDisconnect(callback);

      await adapter.requestAndConnect();

      // Unsubscribe before disconnect fires
      unsub();

      const connectCall = mockBlePlugin.connect.mock.calls[0][0];
      connectCall.onDisconnect();

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
