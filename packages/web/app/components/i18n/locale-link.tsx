'use client';

import React from 'react';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import { localeHref, stripLocalePrefix } from '@/app/lib/i18n/locale-href';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale, isSupportedLocale } from '@/app/lib/i18n/config';

type LocaleLinkProps = Omit<React.ComponentProps<typeof NextLink>, 'href'> & {
  href: string;
  locale?: Locale;
};

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
  let stripped = href;
  for (const candidate of SUPPORTED_LOCALES) {
    if (candidate === DEFAULT_LOCALE) continue;
    stripped = stripLocalePrefix(stripped, candidate);
  }
  return localeHref(stripped, locale);
}

export default function LocaleLink({ href, locale, ...rest }: LocaleLinkProps) {
  const { i18n } = useTranslation();
  const activeLocale: Locale = locale ?? (isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE);
  return <NextLink href={applyLocale(href, activeLocale)} {...rest} />;
}
