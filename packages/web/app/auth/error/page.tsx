import React, { Suspense } from 'react';
import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import { getLocale } from '@/app/lib/i18n/get-locale';
import I18nProvider from '@/app/components/providers/i18n-provider';
import AuthErrorContent from './auth-error-content';

export const metadata = createNoIndexMetadata({
  title: 'Authentication Error',
  description: 'An error occurred during authentication',
  path: '/auth/error',
});

export default async function AuthErrorPage() {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <Suspense fallback={null}>
        <AuthErrorContent />
      </Suspense>
    </I18nProvider>
  );
}
