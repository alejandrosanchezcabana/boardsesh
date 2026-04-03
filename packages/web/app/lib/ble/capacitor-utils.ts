export const isCapacitor = (): boolean =>
  typeof window !== 'undefined' && window.Capacitor !== undefined;

/**
 * Detect if we're running inside a Capacitor WebView even before
 * window.Capacitor is injected, using user-agent heuristics.
 *
 * Android WebView UA contains "; wv)" — a reliable, long-standing marker.
 * iOS WKWebView (loaded by a native app) omits the "Safari" token.
 */
export const isCapacitorWebView = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroidWebView = /Android/.test(ua) && /\bwv\b/.test(ua);
  const isIOSWebView = /iPhone|iPad|iPod/.test(ua) && !/Safari/.test(ua);
  return isAndroidWebView || isIOSWebView;
};

/**
 * Wait for window.Capacitor to become available, with a timeout.
 * Resolves true if Capacitor appeared, false if timed out.
 */
export const waitForCapacitor = (
  timeoutMs = 2000,
  intervalMs = 100,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (isCapacitor()) {
      resolve(true);
      return;
    }
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += intervalMs;
      if (isCapacitor()) {
        clearInterval(timer);
        resolve(true);
      } else if (elapsed >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, intervalMs);
  });

export const isNativeApp = (): boolean =>
  isCapacitor() && window.Capacitor?.isNativePlatform?.() === true;

export const getPlatform = (): 'ios' | 'android' | 'web' => {
  if (!isCapacitor()) return 'web';
  const platform = window.Capacitor?.getPlatform?.();
  if (platform === 'ios' || platform === 'android') return platform;
  return 'web';
};
