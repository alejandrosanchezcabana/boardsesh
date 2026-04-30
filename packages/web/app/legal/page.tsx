import React from 'react';
import { createPageMetadata } from '@/app/lib/seo/metadata';
import { getServerTranslation } from '@/app/lib/i18n/server';
import LegalContent from './legal-content';

export async function generateMetadata() {
  const { t, locale } = await getServerTranslation('marketing');
  return createPageMetadata({
    title: t('metadata.legal.title'),
    description: t('metadata.legal.description'),
    path: '/legal',
    locale,
  });
}

export default function LegalPage() {
  return <LegalContent />;
}
