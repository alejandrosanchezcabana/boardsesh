import React from 'react';
import { createPageMetadata } from '@/app/lib/seo/metadata';
import { getServerTranslation } from '@/app/lib/i18n/server';
import HelpContent from './help-content';

export async function generateMetadata() {
  const { t, locale } = await getServerTranslation('marketing');
  return createPageMetadata({
    title: t('metadata.help.title'),
    description: t('metadata.help.description'),
    path: '/help',
    locale,
  });
}

export default function HelpPage() {
  return <HelpContent />;
}
