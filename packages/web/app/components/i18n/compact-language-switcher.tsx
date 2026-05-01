'use client';

import React, { Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type Locale,
} from '@/app/lib/i18n/config';
import { localeHref, stripLocalePrefix } from '@/app/lib/i18n/locale-href';

const FLAGS: Record<Locale, string> = {
  'en-US': '🇺🇸',
  es: '🇪🇸',
};
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function nextLocaleAfter(current: Locale): Locale {
  const idx = SUPPORTED_LOCALES.indexOf(current);
  return SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length];
}

function CompactLanguageSwitcherInner() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const { i18n, t } = useTranslation('common');
  const current: Locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const next = nextLocaleAfter(current);

  const handleClick = () => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
    void i18n.changeLanguage(next);
    const basePath = stripLocalePrefix(pathname, current);
    const target = localeHref(basePath, next);
    const query = searchParams?.toString();
    router.push(query ? `${target}?${query}` : target);
  };

  return (
    <Tooltip title={t('languageSwitcher.switchTo', { language: LOCALE_LABELS[next] })}>
      <IconButton
        onClick={handleClick}
        aria-label={t('languageSwitcher.ariaLabel') + `: ${LOCALE_LABELS[current]}`}
        size="small"
      >
        <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
          {FLAGS[current]}
        </span>
      </IconButton>
    </Tooltip>
  );
}

function CompactLanguageSwitcherFallback() {
  return (
    <IconButton disabled size="small" aria-label="Language">
      <span style={{ fontSize: 20, lineHeight: 1 }} aria-hidden>
        {FLAGS[DEFAULT_LOCALE]}
      </span>
    </IconButton>
  );
}

export default function CompactLanguageSwitcher() {
  return (
    <Suspense fallback={<CompactLanguageSwitcherFallback />}>
      <CompactLanguageSwitcherInner />
    </Suspense>
  );
}
