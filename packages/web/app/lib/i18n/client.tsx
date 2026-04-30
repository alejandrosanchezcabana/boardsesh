'use client';

import React, { useMemo } from 'react';
import i18next, { type i18n } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, DEFAULT_NAMESPACE, SUPPORTED_LOCALES, type Locale } from './config';

// Module-level singleton. The language switcher routes via `next/link` so the
// browser navigates to the new locale's URL — that re-runs the server pipeline,
// re-mounts the provider with fresh resources, and React reconciles every
// translated subtree. We only fall through to `changeLanguage` here for the
// rare case where a parent re-renders this provider with a new `locale` prop
// without a navigation; in that path consumers may need a tick to re-render
// because the singleton's identity hasn't changed. Acceptable for v1; revisit
// if we add a no-navigation in-app toggle.
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
