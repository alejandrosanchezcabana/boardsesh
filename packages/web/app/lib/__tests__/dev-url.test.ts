import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { renderHook, waitFor } from '@testing-library/react';

import { clearDevUrl, getDevUrlState, setDevUrl, useDevUrl } from '../dev-url';

type MockPlugin = {
  getState: ReturnType<typeof vi.fn>;
  setUrl: ReturnType<typeof vi.fn>;
  clearUrl: ReturnType<typeof vi.fn>;
};

type MockCapacitor = {
  isNativePlatform: () => boolean;
  getPlatform: () => string;
  Plugins: { DevUrl?: MockPlugin };
};

function installCapacitor(plugin: MockPlugin | undefined, isNative = true) {
  const cap: MockCapacitor = {
    isNativePlatform: () => isNative,
    getPlatform: () => 'android',
    Plugins: plugin ? { DevUrl: plugin } : {},
  };
  (window as unknown as { Capacitor: MockCapacitor }).Capacitor = cap;
}

function uninstallCapacitor() {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
}

function makePlugin(overrides: Partial<MockPlugin> = {}): MockPlugin {
  return {
    getState: vi.fn().mockResolvedValue({
      isDebug: true,
      currentUrl: null,
      defaultUrl: 'https://www.boardsesh.com',
    }),
    setUrl: vi.fn().mockResolvedValue(undefined),
    clearUrl: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('dev-url lib', () => {
  beforeEach(() => {
    uninstallCapacitor();
  });

  afterEach(() => {
    uninstallCapacitor();
  });

  describe('getDevUrlState', () => {
    it('returns null when Capacitor is not installed', async () => {
      expect(await getDevUrlState()).toBeNull();
    });

    it('returns null when not running as a native app', async () => {
      installCapacitor(makePlugin(), false);
      expect(await getDevUrlState()).toBeNull();
    });

    it('returns null when the plugin is missing', async () => {
      installCapacitor(undefined, true);
      expect(await getDevUrlState()).toBeNull();
    });

    it('returns the plugin state when native and available', async () => {
      const plugin = makePlugin({
        getState: vi.fn().mockResolvedValue({
          isDebug: true,
          currentUrl: 'https://dev.boardsesh.ts.net',
          defaultUrl: 'https://www.boardsesh.com',
        }),
      });
      installCapacitor(plugin);

      const state = await getDevUrlState();

      expect(state).toEqual({
        isDebug: true,
        currentUrl: 'https://dev.boardsesh.ts.net',
        defaultUrl: 'https://www.boardsesh.com',
      });
    });

    it('normalizes missing currentUrl to null (defensive against Android omitting the key)', async () => {
      const plugin = makePlugin({
        getState: vi.fn().mockResolvedValue({
          isDebug: true,
          defaultUrl: 'https://www.boardsesh.com',
          // currentUrl intentionally absent
        }),
      });
      installCapacitor(plugin);

      const state = await getDevUrlState();

      expect(state?.currentUrl).toBeNull();
    });

    it('returns null when the plugin throws', async () => {
      const plugin = makePlugin({
        getState: vi.fn().mockRejectedValue(new Error('boom')),
      });
      installCapacitor(plugin);

      expect(await getDevUrlState()).toBeNull();
    });
  });

  describe('setDevUrl', () => {
    it('forwards the URL to the plugin', async () => {
      const plugin = makePlugin();
      installCapacitor(plugin);

      await setDevUrl('https://preview.boardsesh.com');

      expect(plugin.setUrl).toHaveBeenCalledWith({ url: 'https://preview.boardsesh.com' });
    });

    it('is a no-op when Capacitor is not installed', async () => {
      await setDevUrl('https://preview.boardsesh.com');
    });

    it('is a no-op when not a native app', async () => {
      const plugin = makePlugin();
      installCapacitor(plugin, false);

      await setDevUrl('https://preview.boardsesh.com');

      expect(plugin.setUrl).not.toHaveBeenCalled();
    });

    it('propagates plugin rejections so callers can surface the error', async () => {
      const plugin = makePlugin({
        setUrl: vi.fn().mockRejectedValue(new Error('Invalid URL')),
      });
      installCapacitor(plugin);

      await expect(setDevUrl('not a url')).rejects.toThrow('Invalid URL');
    });
  });

  describe('clearDevUrl', () => {
    it('calls the plugin', async () => {
      const plugin = makePlugin();
      installCapacitor(plugin);

      await clearDevUrl();

      expect(plugin.clearUrl).toHaveBeenCalled();
    });

    it('is a no-op when the plugin is missing', async () => {
      await clearDevUrl();
    });
  });

  describe('useDevUrl', () => {
    it('reports not available when Capacitor is missing', async () => {
      const { result } = renderHook(() => useDevUrl());

      await waitFor(() => {
        expect(result.current.state).toBeNull();
      });

      expect(result.current.isAvailable).toBe(false);
    });

    it('reports available when native + isDebug is true', async () => {
      installCapacitor(makePlugin());

      const { result } = renderHook(() => useDevUrl());

      await waitFor(() => {
        expect(result.current.state?.isDebug).toBe(true);
      });

      expect(result.current.isAvailable).toBe(true);
    });

    it('reports not available when native but isDebug is false (release build)', async () => {
      const plugin = makePlugin({
        getState: vi.fn().mockResolvedValue({
          isDebug: false,
          currentUrl: null,
          defaultUrl: 'https://www.boardsesh.com',
        }),
      });
      installCapacitor(plugin);

      const { result } = renderHook(() => useDevUrl());

      await waitFor(() => {
        expect(result.current.state).not.toBeNull();
      });

      expect(result.current.isAvailable).toBe(false);
    });
  });
});
