import React from 'react';
import { I18nProvider as ClientI18nProvider } from '@/app/lib/i18n/client';
import { loadServerResources } from '@/app/lib/i18n/server';
import { SEED_NAMESPACES, type Locale } from '@/app/lib/i18n/config';

export default async function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const resources = await loadServerResources(locale, SEED_NAMESPACES);
  return (
    <ClientI18nProvider locale={locale} resources={resources}>
      {children}
    </ClientI18nProvider>
  );
}
