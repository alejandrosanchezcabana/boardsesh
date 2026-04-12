import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockIsNativeApp = vi.fn();
vi.mock('@/app/lib/ble/capacitor-utils', () => ({
  isNativeApp: () => mockIsNativeApp(),
}));

import {
  getNativeTabBarPlugin,
  addNativeOverlay,
  removeNativeOverlay,
  _resetOverlayCountForTesting,
} from '../native-tab-bar-plugin';

// Build a mock plugin installed on window.Capacitor
function installMockPlugin() {
  const mock = {
    setActiveTab: vi.fn().mockResolvedValue(undefined),
    setBarsHidden: vi.fn().mockResolvedValue(undefined),
    setNotificationBadge: vi.fn().mockResolvedValue(undefined),
  };
  Object.defineProperty(window, 'Capacitor', {
    value: { isNativePlatform: () => true, Plugins: { NativeTabBar: mock } },
    writable: true,
    configurable: true,
  });
  return mock;
}

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
      value: { isNativePlatform: () => true, Plugins: {} },
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
    const mockPlugin = installMockPlugin();
    const result = getNativeTabBarPlugin();
    expect(result).toBe(mockPlugin);
  });

  it('returned plugin object has setActiveTab, setBarsHidden, and setNotificationBadge', () => {
    mockIsNativeApp.mockReturnValue(true);
    installMockPlugin();
    const result = getNativeTabBarPlugin();
    expect(typeof result?.setActiveTab).toBe('function');
    expect(typeof result?.setBarsHidden).toBe('function');
    expect(typeof result?.setNotificationBadge).toBe('function');
  });
});

describe('addNativeOverlay / removeNativeOverlay', () => {
  let mockPlugin: ReturnType<typeof installMockPlugin>;

  beforeEach(() => {
    mockIsNativeApp.mockReturnValue(true);
    mockPlugin = installMockPlugin();
    _resetOverlayCountForTesting();
  });

  afterEach(() => {
    _resetOverlayCountForTesting();
    Object.defineProperty(window, 'Capacitor', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('calls setBarsHidden({ hidden: true }) on the first addNativeOverlay', () => {
    addNativeOverlay();
    expect(mockPlugin.setBarsHidden).toHaveBeenCalledWith({ hidden: true });
    expect(mockPlugin.setBarsHidden).toHaveBeenCalledTimes(1);
  });

  it('does NOT call setBarsHidden again when a second overlay is added', () => {
    addNativeOverlay();
    mockPlugin.setBarsHidden.mockClear();
    addNativeOverlay();
    expect(mockPlugin.setBarsHidden).not.toHaveBeenCalled();
  });

  it('does NOT call setBarsHidden when count goes from 2 to 1', () => {
    addNativeOverlay();
    addNativeOverlay();
    mockPlugin.setBarsHidden.mockClear();
    removeNativeOverlay();
    expect(mockPlugin.setBarsHidden).not.toHaveBeenCalled();
  });

  it('calls setBarsHidden({ hidden: false }) when the last overlay is removed', () => {
    addNativeOverlay();
    mockPlugin.setBarsHidden.mockClear();
    removeNativeOverlay();
    expect(mockPlugin.setBarsHidden).toHaveBeenCalledWith({ hidden: false });
    expect(mockPlugin.setBarsHidden).toHaveBeenCalledTimes(1);
  });

  it('does not go below 0 if removeNativeOverlay is called with no overlay', () => {
    // Should not throw and should not call setBarsHidden
    removeNativeOverlay();
    expect(mockPlugin.setBarsHidden).not.toHaveBeenCalled();
  });

  it('_resetOverlayCountForTesting resets count so next add calls setBarsHidden again', () => {
    addNativeOverlay();
    addNativeOverlay();
    _resetOverlayCountForTesting();
    mockPlugin.setBarsHidden.mockClear();
    addNativeOverlay();
    expect(mockPlugin.setBarsHidden).toHaveBeenCalledWith({ hidden: true });
  });
});
