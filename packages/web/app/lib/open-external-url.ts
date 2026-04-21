import { isNativeApp } from "@/app/lib/ble/capacitor-utils";

/**
 * Opens an external URL. On native apps, uses Capacitor's Browser plugin
 * (SFSafariViewController on iOS) to keep the user in the app. On web,
 * falls back to window.open().
 */
export function openExternalUrl(url: string): void {
  if (isNativeApp()) {
    const browser = window.Capacitor?.Plugins?.Browser;
    if (browser) {
      browser.open({ url }).catch(() => {
        // Fallback if plugin fails
        window.open(url, "_blank", "noopener");
      });
      return;
    }
  }
  window.open(url, "_blank", "noopener");
}
