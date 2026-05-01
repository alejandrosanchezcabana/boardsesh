import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from './config';

export type LocaleDetection = {
  locale: Locale;
  strippedPath: string;
  needsRewrite: boolean;
};

/**
 * Map a request path to a locale and the underlying English route.
 *
 * Iterates SUPPORTED_LOCALES (skipping the default) so adding a new locale to
 * config.ts is sufficient — no middleware edit required.
 */
export function detectLocale(pathname: string): LocaleDetection {
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const prefix = `/${locale}`;
    if (pathname === prefix) {
      return { locale, strippedPath: '/', needsRewrite: true };
    }
    if (pathname.startsWith(`${prefix}/`)) {
      return { locale, strippedPath: pathname.slice(prefix.length), needsRewrite: true };
    }
  }
  return { locale: DEFAULT_LOCALE, strippedPath: pathname, needsRewrite: false };
}
