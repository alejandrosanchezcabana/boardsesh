import 'server-only';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_HEADER, type Locale, isSupportedLocale } from './config';

export async function getLocale(): Promise<Locale> {
  const headerList = await headers();
  const value = headerList.get(LOCALE_HEADER);
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
