import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  registerBluetoothConnection,
  disconnectAllBluetooth,
} from '../bluetooth-status-store';

// Track release functions so each test can clear its own registrations
// (the store keeps module-level state).
const pendingReleases: Array<() => void> = [];

function register(disconnect: () => void): () => void {
  const release = registerBluetoothConnection(disconnect);
  pendingReleases.push(release);
  return release;
}

afterEach(() => {
  while (pendingReleases.length > 0) {
    pendingReleases.pop()?.();
  }
});

describe('bluetooth-status-store', () => {
  describe('registerBluetoothConnection', () => {
    it('returns a release function that is idempotent', () => {
      const disconnect = vi.fn();
      const release = register(disconnect);
      release();
      release();
      expect(disconnect).not.toHaveBeenCalled();
    });
  });

  describe('disconnectAllBluetooth', () => {
    it('invokes every registered disconnect handler', () => {
      const a = vi.fn();
      const b = vi.fn();
      register(a);
      register(b);

      disconnectAllBluetooth();

      expect(a).toHaveBeenCalledOnce();
      expect(b).toHaveBeenCalledOnce();
    });

    it('continues invoking handlers when one throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const broken = vi.fn(() => { throw new Error('boom'); });
      const ok = vi.fn();
      register(broken);
      register(ok);

      disconnectAllBluetooth();

      expect(broken).toHaveBeenCalledOnce();
      expect(ok).toHaveBeenCalledOnce();
      consoleSpy.mockRestore();
    });

    it('is a no-op when nothing is registered', () => {
      expect(() => disconnectAllBluetooth()).not.toThrow();
    });
  });
});
