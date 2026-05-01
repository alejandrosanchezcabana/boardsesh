import React from 'react';
import { I18nProvider as ClientI18nProvider } from '@/app/lib/i18n/client';
import { loadServerResources } from '@/app/lib/i18n/server';
import { ROOT_NAMESPACES, type Locale, type SeedNamespace } from '@/app/lib/i18n/config';

export default async function I18nProvider({
  locale,
  namespaces = ROOT_NAMESPACES,
  children,
}: {
  locale: Locale;
  namespaces?: readonly SeedNamespace[];
  children: React.ReactNode;
}) {
  const resources = await loadServerResources(locale, namespaces);
  return (
    <ClientI18nProvider locale={locale} resources={resources}>
      {children}
    </ClientI18nProvider>
  );
}
