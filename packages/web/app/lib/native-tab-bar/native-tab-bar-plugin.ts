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
