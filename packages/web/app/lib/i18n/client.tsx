'use client';

import React, { useMemo } from 'react';
import i18next, { type i18n } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, DEFAULT_NAMESPACE, SUPPORTED_LOCALES, type Locale } from './config';

let clientInstance: i18n | undefined;

function getClientInstance(locale: Locale, resources: Record<string, Record<string, unknown>>): i18n {
  if (clientInstance) {
    for (const [ns, bundle] of Object.entries(resources)) {
      if (!clientInstance.hasResourceBundle(locale, ns)) {
        clientInstance.addResourceBundle(locale, ns, bundle, true, true);
      }
    }
    if (clientInstance.language !== locale) {
      void clientInstance.changeLanguage(locale);
    }
    return clientInstance;
  }

  const instance = i18next.createInstance();
  instance
    .use(resourcesToBackend((lng: string, ns: string) => import(`../../../i18n/locales/${lng}/${ns}.json`)))
    .use(initReactI18next)
    .init({
      lng: locale,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES as unknown as string[],
      defaultNS: DEFAULT_NAMESPACE,
      resources: { [locale]: resources },
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  clientInstance = instance;
  return instance;
}

export function I18nProvider({
  locale,
  resources,
  children,
}: {
  locale: Locale;
  resources: Record<string, Record<string, unknown>>;
  children: React.ReactNode;
}) {
  const instance = useMemo(() => getClientInstance(locale, resources), [locale, resources]);
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
