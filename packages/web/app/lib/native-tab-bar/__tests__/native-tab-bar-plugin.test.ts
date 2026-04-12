import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockIsNativeApp = vi.fn();
vi.mock('@/app/lib/ble/capacitor-utils', () => ({
  isNativeApp: () => mockIsNativeApp(),
}));

import { getNativeTabBarPlugin } from '../native-tab-bar-plugin';

describe('getNativeTabBarPlugin', () => {
  beforeEach(() => {
    mockIsNativeApp.mockReturnValue(false);
    Object.defineProperty(window, 'Capacitor', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'Capacitor', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('returns null when isNativeApp() returns false', () => {
    mockIsNativeApp.mockReturnValue(false);
    expect(getNativeTabBarPlugin()).toBeNull();
  });

  it('returns null when native but window.Capacitor.Plugins.NativeTabBar is undefined', () => {
    mockIsNativeApp.mockReturnValue(true);
    Object.defineProperty(window, 'Capacitor', {
      value: {
        isNativePlatform: () => true,
        Plugins: {},
      },
      writable: true,
      configurable: true,
    });
    expect(getNativeTabBarPlugin()).toBeNull();
  });

  it('returns null when native but window.Capacitor is undefined', () => {
    mockIsNativeApp.mockReturnValue(true);
    Object.defineProperty(window, 'Capacitor', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(getNativeTabBarPlugin()).toBeNull();
  });

  it('returns the plugin object when native and plugin is present', () => {
    mockIsNativeApp.mockReturnValue(true);
    const mockPlugin = {
      setActiveTab: vi.fn().mockResolvedValue(undefined),
      setBarsHidden: vi.fn().mockResolvedValue(undefined),
      setNotificationBadge: vi.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(window, 'Capacitor', {
      value: {
        isNativePlatform: () => true,
        Plugins: {
          NativeTabBar: mockPlugin,
        },
      },
      writable: true,
      configurable: true,
    });
    const result = getNativeTabBarPlugin();
    expect(result).toBe(mockPlugin);
  });

  it('returned plugin object has setActiveTab, setBarsHidden, and setNotificationBadge', () => {
    mockIsNativeApp.mockReturnValue(true);
    const mockPlugin = {
      setActiveTab: vi.fn().mockResolvedValue(undefined),
      setBarsHidden: vi.fn().mockResolvedValue(undefined),
      setNotificationBadge: vi.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(window, 'Capacitor', {
      value: {
        isNativePlatform: () => true,
        Plugins: {
          NativeTabBar: mockPlugin,
        },
      },
      writable: true,
      configurable: true,
    });
    const result = getNativeTabBarPlugin();
    expect(typeof result?.setActiveTab).toBe('function');
    expect(typeof result?.setBarsHidden).toBe('function');
    expect(typeof result?.setNotificationBadge).toBe('function');
  });
});
