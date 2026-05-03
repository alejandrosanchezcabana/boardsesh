import React, { Suspense } from 'react';
import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import { getLocale } from '@/app/lib/i18n/get-locale';
import I18nProvider from '@/app/components/providers/i18n-provider';
import VerifyRequestContent from './verify-request-content';

export const metadata = createNoIndexMetadata({
  title: 'Verify Email',
  description: 'Verify your email address',
  path: '/auth/verify-request',
});

export default async function VerifyRequestPage() {
  const locale = await getLocale();
  return (
    <I18nProvider locale={locale} namespaces={['auth']}>
      <Suspense fallback={null}>
        <VerifyRequestContent />
      </Suspense>
    </I18nProvider>
  );
}
