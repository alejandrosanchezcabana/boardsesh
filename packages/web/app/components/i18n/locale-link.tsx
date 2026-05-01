'use client';

import React from 'react';
import NextLink from 'next/link';
import { useTranslation } from 'react-i18next';
import { localeHref } from '@/app/lib/i18n/locale-href';
import { DEFAULT_LOCALE, type Locale, isSupportedLocale } from '@/app/lib/i18n/config';

type LocaleLinkProps = Omit<React.ComponentProps<typeof NextLink>, 'href'> & {
  href: string;
  locale?: Locale;
};

export default function LocaleLink({ href, locale, ...rest }: LocaleLinkProps) {
  const { i18n } = useTranslation();
  const activeLocale: Locale = locale ?? (isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE);
  return <NextLink href={localeHref(href, activeLocale)} {...rest} />;
}
