import { DEFAULT_LOCALE, type Locale } from './config';

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
