import { isNativeApp } from '../ble/capacitor-utils';

interface NativeTabBarPluginInterface {
  setActiveTab(options: { tab: string }): Promise<void>;
  setBarsHidden(options: { hidden: boolean }): Promise<void>;
  setNotificationBadge(options: { count: number }): Promise<void>;
}

export function getNativeTabBarPlugin(): NativeTabBarPluginInterface | null {
  if (!isNativeApp()) return null;
  return (
    (window as unknown as {
      Capacitor?: { Plugins?: { NativeTabBar?: NativeTabBarPluginInterface } };
    }).Capacitor?.Plugins?.NativeTabBar ?? null
  );
}

// MARK: - Overlay ref-counting
//
// Multiple components (BottomTabBar drawers, QueueControlBar drawers) independently
// need to hide the native tab bar while a full-height overlay is open. A simple
// boolean flag races when two overlays are active simultaneously. A ref-counter
// guarantees the bar stays hidden until the last overlay closes.

let nativeOverlayCount = 0;

/** Call when a full-screen overlay opens. Hides the native tab bar on the first call. */
export function addNativeOverlay(): void {
  nativeOverlayCount++;
  if (nativeOverlayCount === 1) {
    getNativeTabBarPlugin()?.setBarsHidden({ hidden: true });
  }
}

/** Call when a full-screen overlay closes. Shows the native tab bar when the last overlay closes. */
export function removeNativeOverlay(): void {
  if (nativeOverlayCount <= 0) return;
  nativeOverlayCount--;
  if (nativeOverlayCount === 0) {
    getNativeTabBarPlugin()?.setBarsHidden({ hidden: false });
  }
}

/** Reset the counter between tests. Never call in production code. */
export function _resetOverlayCountForTesting(): void {
  nativeOverlayCount = 0;
}
