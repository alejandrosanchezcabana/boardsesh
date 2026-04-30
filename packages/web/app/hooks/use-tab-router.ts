'use client';

import { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isNativeApp } from '@/app/lib/ble/capacitor-utils';
import { getNativeTabBarPlugin } from '@/app/lib/native-tab-bar/native-tab-bar-plugin';
import { getActiveTab, TABS_WITH_WEBVIEWS } from '@/app/lib/tab-routing';
import type { Tab } from '@/app/lib/tab-routing';

/**
 * A drop-in replacement for `useRouter()` that intercepts cross-tab navigation
 * on native iOS. When the target URL belongs to a different tab's webview, it
 * calls `NativeTabBar.navigateTab()` instead of performing in-webview navigation.
 *
 * On web (non-native), this passes through to the standard Next.js router.
 */
export function useTabRouter() {
  const router = useRouter();
  const currentPathname = usePathname();

  const push = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      // Forward to next/navigation's router.push, only including the options
      // arg when defined so existing call sites recorded as `push(href)` keep
      // their single-argument shape.
      const pushThrough = (h: string) => {
        if (options === undefined) router.push(h);
        else router.push(h, options);
      };

      if (!isNativeApp()) {
        pushThrough(href);
        return;
      }

      // Extract pathname from the href (strip query string and hash)
      const pathMatch = href.match(/^([^?#]*)/);
      const targetPathname = pathMatch?.[1] ?? href;

      const targetTab = getActiveTab(targetPathname);
      const currentTab = getActiveTab(currentPathname);

      // "create" tab has no dedicated webview — always navigate in-place
      if (targetTab === 'create') {
        pushThrough(href);
        return;
      }

      // Same-tab navigation — stay within the current webview
      if (targetTab === currentTab || !TABS_WITH_WEBVIEWS.has(targetTab)) {
        pushThrough(href);
        return;
      }

      // Cross-tab navigation — switch to the target tab's webview if the
      // native multi-webview plugin is available, otherwise fall back to
      // in-webview navigation. Older iOS builds without NativeTabBarPlugin
      // hit the fallback so they keep working until the user updates.
      const plugin = getNativeTabBarPlugin();
      if (plugin) {
        plugin.navigateTab({ tab: targetTab, url: href });
      } else {
        pushThrough(href);
      }
    },
    [router, currentPathname],
  );

  const replace = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      const replaceThrough = (h: string) => {
        if (options === undefined) router.replace(h);
        else router.replace(h, options);
      };

      if (!isNativeApp()) {
        replaceThrough(href);
        return;
      }

      const pathMatch = href.match(/^([^?#]*)/);
      const targetPathname = pathMatch?.[1] ?? href;

      const targetTab = getActiveTab(targetPathname);
      const currentTab = getActiveTab(currentPathname);

      if (targetTab === 'create' || targetTab === currentTab || !TABS_WITH_WEBVIEWS.has(targetTab)) {
        replaceThrough(href);
        return;
      }

      const plugin = getNativeTabBarPlugin();
      if (plugin) {
        plugin.navigateTab({ tab: targetTab, url: href });
      } else {
        replaceThrough(href);
      }
    },
    [router, currentPathname],
  );

  return {
    ...router,
    push,
    replace,
  };
}

export type { Tab };
