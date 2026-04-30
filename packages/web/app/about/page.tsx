import React from 'react';
import { createPageMetadata } from '@/app/lib/seo/metadata';
import { getServerTranslation } from '@/app/lib/i18n/server';
import AboutContent from './about-content';

export async function generateMetadata() {
  const { t, locale } = await getServerTranslation('marketing');
  return createPageMetadata({
    title: t('metadata.about.title'),
    description: t('metadata.about.description'),
    path: '/about',
    locale,
  });
}

export default function AboutPage() {
  return <AboutContent />;
}
