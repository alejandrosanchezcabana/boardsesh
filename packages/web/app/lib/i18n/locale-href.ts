import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './config';

const PASS_THROUGH_RE = /^(https?:|\/\/|mailto:|tel:|#)/i;

export function localeHref(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) {
    return path;
  }
  if (!path.startsWith('/')) {
    return `/${locale}/${path}`;
  }
  if (path === '/') {
    return `/${locale}`;
  }
  return `/${locale}${path}`;
}

export function stripLocalePrefix(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) {
    return path;
  }
  const prefix = `/${locale}`;
  if (path === prefix) {
    return '/';
  }
  if (path.startsWith(`${prefix}/`)) {
    return path.slice(prefix.length);
  }
  return path;
}

export function shouldPassThrough(href: string): boolean {
  if (!href) return true;
  if (href.startsWith('/api/')) return true;
  return PASS_THROUGH_RE.test(href);
}

export function alreadyPrefixed(href: string): boolean {
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (href === `/${locale}` || href.startsWith(`/${locale}/`) || href.startsWith(`/${locale}?`)) {
      return true;
    }
  }
  return false;
}

export function applyLocale(href: string, locale: Locale): string {
  if (shouldPassThrough(href)) return href;
  if (!alreadyPrefixed(href)) return localeHref(href, locale);
  let stripped = href;
  for (const candidate of SUPPORTED_LOCALES) {
    if (candidate === DEFAULT_LOCALE) continue;
    stripped = stripLocalePrefix(stripped, candidate);
  }
  return localeHref(stripped, locale);
}
