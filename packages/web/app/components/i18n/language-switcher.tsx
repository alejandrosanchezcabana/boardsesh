'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type Locale,
  isSupportedLocale,
} from '@/app/lib/i18n/config';
import { localeHref, stripLocalePrefix } from '@/app/lib/i18n/locale-href';

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const { i18n } = useTranslation();
  const currentLocale: Locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;

  const handleChange = (event: SelectChangeEvent) => {
    const next = event.target.value;
    if (!isSupportedLocale(next) || next === currentLocale) {
      return;
    }
    const basePath = stripLocalePrefix(pathname, currentLocale);
    const target = localeHref(basePath, next);
    const query = searchParams?.toString();
    router.push(query ? `${target}?${query}` : target);
  };

  return (
    <FormControl size="small">
      <Select
        value={currentLocale}
        onChange={handleChange}
        inputProps={{ 'aria-label': 'Language' }}
        sx={{ minWidth: 120 }}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <MenuItem key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
