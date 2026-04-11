import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createBluetoothAdapter, _resetFactoryCache } from '../adapter-factory';

describe('adapter-factory', () => {
  let originalCapacitor: unknown;

  beforeEach(() => {
    // Save original Capacitor state
    originalCapacitor = (globalThis as unknown as Record<string, unknown>).Capacitor;
  });

  afterEach(() => {
    // Restore original Capacitor state and reset cache
    _resetFactoryCache();
    if (originalCapacitor === undefined) {
      delete (globalThis as unknown as Record<string, unknown>).Capacitor;
    } else {
      (globalThis as unknown as Record<string, unknown>).Capacitor = originalCapacitor;
    }
  });

  describe('_resetFactoryCache', () => {
    it('is a function that clears the internal cache', () => {
      expect(typeof _resetFactoryCache).toBe('function');
      // The function should not throw
      _resetFactoryCache();
    });

    it('allows multiple adapter detections by resetting cache state', async () => {
      // First call - should detect platform
      delete (globalThis as unknown as Record<string, unknown>).Capacitor;
      const adapter1 = await createBluetoothAdapter('kilter');
      expect(adapter1).toBeDefined();
      expect(typeof adapter1.isAvailable).toBe('function');

      // Reset cache to allow re-detection
      _resetFactoryCache();

      // Should be able to create adapter again
      const adapter2 = await createBluetoothAdapter('kilter');
      expect(adapter2).toBeDefined();
      expect(typeof adapter2.isAvailable).toBe('function');
    });
  });

  describe('createBluetoothAdapter', () => {
    it('returns an adapter with all required methods', async () => {
      delete (globalThis as unknown as Record<string, unknown>).Capacitor;
      _resetFactoryCache();

      const adapter = await createBluetoothAdapter('kilter');

      // Verify the adapter implements the BluetoothAdapter interface
      expect(typeof adapter.isAvailable).toBe('function');
      expect(typeof adapter.requestAndConnect).toBe('function');
      expect(typeof adapter.disconnect).toBe('function');
      expect(typeof adapter.write).toBe('function');
      expect(typeof adapter.onDisconnect).toBe('function');
    });

    it('returns consistent adapter instances from cache', async () => {
      delete (globalThis as unknown as Record<string, unknown>).Capacitor;
      _resetFactoryCache();

      const adapter1 = await createBluetoothAdapter('kilter');
      const adapter2 = await createBluetoothAdapter('tension');

      // Both should have the same constructor name (same adapter type, cached factory)
      expect(adapter1.constructor.name).toBe(adapter2.constructor.name);
    });
  });
});
