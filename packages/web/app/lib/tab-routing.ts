/**
 * Shared tab routing logic used by both the bottom tab bar component
 * and the useTabRouter hook for cross-tab navigation interception.
 */

export type Tab = 'home' | 'climbs' | 'library' | 'feed' | 'create' | 'you';

/**
 * Maps a URL pathname to the corresponding tab key.
 * This logic must stay in sync with `MultiWebViewController.tabForPath()` in Swift.
 */
export const getActiveTab = (pathname: string): Tab => {
  if (pathname === '/') return 'home';
  if (pathname.endsWith('/create')) return 'create';
  if (pathname.startsWith('/feed')) return 'feed';
  if (pathname.startsWith('/you')) return 'you';
  if (pathname.startsWith('/playlists')) return 'library';
  return 'climbs';
};

/**
 * Tabs that have their own dedicated webview in the native multi-webview setup.
 * The "create" tab has no dedicated webview — it's an action on the current tab.
 */
export const TABS_WITH_WEBVIEWS: ReadonlySet<Tab> = new Set(['home', 'climbs', 'library', 'feed', 'you']);
