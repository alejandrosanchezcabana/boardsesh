import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockPathname = '/';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => mockPathname,
}));

const mockIsNativeApp = vi.fn();
vi.mock('@/app/lib/ble/capacitor-utils', () => ({
  isNativeApp: () => mockIsNativeApp(),
}));

const mockNavigateTab = vi.fn().mockResolvedValue(undefined);
let mockPluginInstance: { navigateTab: typeof mockNavigateTab } | null = null;

vi.mock('@/app/lib/native-tab-bar/native-tab-bar-plugin', () => ({
  getNativeTabBarPlugin: () => mockPluginInstance,
}));

import { useTabRouter } from '../use-tab-router';

describe('useTabRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
  });

  describe('on web (non-native)', () => {
    beforeEach(() => {
      mockIsNativeApp.mockReturnValue(false);
      mockPluginInstance = null;
    });

    it('push proxies through to router.push', () => {
      const { result } = renderHook(() => useTabRouter());
      act(() => result.current.push('/feed'));
      expect(mockPush).toHaveBeenCalledWith('/feed');
      expect(mockNavigateTab).not.toHaveBeenCalled();
    });

    it('replace proxies through to router.replace', () => {
      const { result } = renderHook(() => useTabRouter());
      act(() => result.current.replace('/you'));
      expect(mockReplace).toHaveBeenCalledWith('/you');
    });
  });

  describe('on native iOS WITH the plugin (new binary)', () => {
    beforeEach(() => {
      mockIsNativeApp.mockReturnValue(true);
      mockPluginInstance = { navigateTab: mockNavigateTab };
    });

    it('push routes cross-tab navigations through navigateTab', () => {
      mockPathname = '/'; // home tab
      const { result } = renderHook(() => useTabRouter());
      act(() => result.current.push('/feed'));
      expect(mockNavigateTab).toHaveBeenCalledWith({ tab: 'feed', url: '/feed' });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('push stays in-webview for same-tab navigation', () => {
      mockPathname = '/feed';
      const { result } = renderHook(() => useTabRouter());
      act(() => result.current.push('/feed/post/123'));
      expect(mockPush).toHaveBeenCalledWith('/feed/post/123');
      expect(mockNavigateTab).not.toHaveBeenCalled();
    });

    it('push stays in-webview when target is the create tab', () => {
      mockPathname = '/feed';
      const { result } = renderHook(() => useTabRouter());
      act(() => result.current.push('/kilter/40/create'));
      expect(mockPush).toHaveBeenCalled();
      expect(mockNavigateTab).not.toHaveBeenCalled();
    });
  });

  // Backwards-compat: old App Store / TestFlight binaries are native but
  // don't ship NativeTabBarPlugin. The hook must fall back to in-webview
  // navigation so tab taps don't silently no-op for those users.
  describe('on native iOS WITHOUT the plugin (old binary)', () => {
    beforeEach(() => {
      mockIsNativeApp.mockReturnValue(true);
      mockPluginInstance = null;
    });

    it('push falls back to router.push for cross-tab nav', () => {
      mockPathname = '/'; // home tab
      const { result } = renderHook(() => useTabRouter());
      act(() => result.current.push('/feed'));
      expect(mockPush).toHaveBeenCalledWith('/feed');
      expect(mockNavigateTab).not.toHaveBeenCalled();
    });

    it('replace falls back to router.replace for cross-tab nav', () => {
      mockPathname = '/';
      const { result } = renderHook(() => useTabRouter());
      act(() => result.current.replace('/you'));
      expect(mockReplace).toHaveBeenCalledWith('/you');
      expect(mockNavigateTab).not.toHaveBeenCalled();
    });
  });
});
