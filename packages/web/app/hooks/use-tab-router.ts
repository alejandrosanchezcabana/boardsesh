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
      if (!isNativeApp()) {
        router.push(href, options);
        return;
      }

      // Extract pathname from the href (strip query string and hash)
      const pathMatch = href.match(/^([^?#]*)/);
      const targetPathname = pathMatch?.[1] ?? href;

      const targetTab = getActiveTab(targetPathname);
      const currentTab = getActiveTab(currentPathname);

      // "create" tab has no dedicated webview — always navigate in-place
      if (targetTab === 'create') {
        router.push(href, options);
        return;
      }

      // Same-tab navigation — stay within the current webview
      if (targetTab === currentTab || !TABS_WITH_WEBVIEWS.has(targetTab)) {
        router.push(href, options);
        return;
      }

      // Cross-tab navigation — switch to the target tab's webview
      getNativeTabBarPlugin()?.navigateTab({ tab: targetTab, url: href });
    },
    [router, currentPathname],
  );

  const replace = useCallback(
    (href: string, options?: { scroll?: boolean }) => {
      if (!isNativeApp()) {
        router.replace(href, options);
        return;
      }

      const pathMatch = href.match(/^([^?#]*)/);
      const targetPathname = pathMatch?.[1] ?? href;

      const targetTab = getActiveTab(targetPathname);
      const currentTab = getActiveTab(currentPathname);

      if (targetTab === 'create' || targetTab === currentTab || !TABS_WITH_WEBVIEWS.has(targetTab)) {
        router.replace(href, options);
        return;
      }

      getNativeTabBarPlugin()?.navigateTab({ tab: targetTab, url: href });
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
