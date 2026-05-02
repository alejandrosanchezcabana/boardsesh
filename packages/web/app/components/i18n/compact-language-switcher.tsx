'use client';

import React, { Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
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
const flagSx = { fontSize: 20, lineHeight: 1 };

function nextLocaleAfter(current: Locale): Locale {
  const idx = SUPPORTED_LOCALES.indexOf(current);
  return SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length];
}

type LabelProps = {
  ariaLabel: string;
  flag: string;
};

function CompactLanguageSwitcherInner({
  ariaLabelTemplate,
  switchToTemplate,
}: {
  ariaLabelTemplate: (label: string) => string;
  switchToTemplate: (label: string) => string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const { i18n } = useTranslation('common');
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
    <Tooltip title={switchToTemplate(LOCALE_LABELS[next])}>
      <IconButton onClick={handleClick} aria-label={ariaLabelTemplate(LOCALE_LABELS[current])} size="small">
        <Box component="span" sx={flagSx} aria-hidden>
          {FLAGS[current]}
        </Box>
      </IconButton>
    </Tooltip>
  );
}

function CompactLanguageSwitcherFallback({ ariaLabel, flag }: LabelProps) {
  return (
    <IconButton disabled size="small" aria-label={ariaLabel}>
      <Box component="span" sx={flagSx} aria-hidden>
        {flag}
      </Box>
    </IconButton>
  );
}

export default function CompactLanguageSwitcher() {
  // Resolve translations at the parent so the Suspense fallback (which can't
  // call hooks during the suspended render) still announces in the user's
  // active language. The fallback shows for ~one tick while useSearchParams
  // resolves; resolved labels prevent screen readers from reading English
  // chrome on a Spanish page.
  const { i18n, t } = useTranslation('common');
  const fallbackLocale: Locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
  const ariaLabelTemplate = (label: string) => t('languageSwitcher.ariaLabelWithCurrent', { language: label });
  const switchToTemplate = (label: string) => t('languageSwitcher.switchTo', { language: label });

  return (
    <Suspense
      fallback={
        <CompactLanguageSwitcherFallback
          ariaLabel={ariaLabelTemplate(LOCALE_LABELS[fallbackLocale])}
          flag={FLAGS[fallbackLocale]}
        />
      }
    >
      <CompactLanguageSwitcherInner ariaLabelTemplate={ariaLabelTemplate} switchToTemplate={switchToTemplate} />
    </Suspense>
  );
}
