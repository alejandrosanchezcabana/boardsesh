'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { localeHref, stripLocalePrefix } from './locale-href';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale, type Locale } from './config';

const PASS_THROUGH_RE = /^(https?:|\/\/|mailto:|tel:|#)/i;

function shouldPassThrough(href: string): boolean {
  if (!href) return true;
  if (href.startsWith('/api/')) return true;
  return PASS_THROUGH_RE.test(href);
}

function alreadyPrefixed(href: string): boolean {
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (href === `/${locale}` || href.startsWith(`/${locale}/`) || href.startsWith(`/${locale}?`)) {
      return true;
    }
  }
  return false;
}

function applyLocale(href: string, locale: Locale): string {
  if (shouldPassThrough(href)) return href;
  if (!alreadyPrefixed(href)) return localeHref(href, locale);
  // Strip whichever non-default prefix is present, then re-apply the active one.
  let stripped = href;
  for (const candidate of SUPPORTED_LOCALES) {
    if (candidate === DEFAULT_LOCALE) continue;
    stripped = stripLocalePrefix(stripped, candidate);
  }
  return localeHref(stripped, locale);
}

type RouterPushOptions = Parameters<ReturnType<typeof useRouter>['push']>[1];
type RouterReplaceOptions = Parameters<ReturnType<typeof useRouter>['replace']>[1];
type RouterPrefetchOptions = Parameters<ReturnType<typeof useRouter>['prefetch']>[1];

export function useLocaleRouter() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const activeLocale: Locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;

  const push = useCallback(
    (href: string, options?: RouterPushOptions) => {
      const target = applyLocale(href, activeLocale);
      return options === undefined ? router.push(target) : router.push(target, options);
    },
    [router, activeLocale],
  );

  const replace = useCallback(
    (href: string, options?: RouterReplaceOptions) => {
      const target = applyLocale(href, activeLocale);
      return options === undefined ? router.replace(target) : router.replace(target, options);
    },
    [router, activeLocale],
  );

  const prefetch = useCallback(
    (href: string, options?: RouterPrefetchOptions) => {
      const target = applyLocale(href, activeLocale);
      return options === undefined ? router.prefetch(target) : router.prefetch(target, options);
    },
    [router, activeLocale],
  );

  return useMemo(
    () => ({
      push,
      replace,
      prefetch,
      back: () => router.back?.(),
      forward: () => router.forward?.(),
      refresh: () => router.refresh?.(),
    }),
    [push, replace, prefetch, router],
  );
}
