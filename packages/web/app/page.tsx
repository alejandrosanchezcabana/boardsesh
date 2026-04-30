import React from 'react';
import { createPageMetadata } from '@/app/lib/seo/metadata';
import { getServerTranslation } from '@/app/lib/i18n/server';
import { getAllBoardConfigs } from './lib/server-board-configs';
import { getPopularBoardConfigs } from './lib/server-popular-configs';
import HomePageContent from './home-page-content';

export const revalidate = false;

export async function generateMetadata() {
  const { t, locale } = await getServerTranslation('marketing');
  return createPageMetadata({
    title: t('metadata.home.title'),
    description: t('metadata.home.description'),
    path: '/',
    locale,
  });
}

export default async function Home() {
  const [boardConfigs, popularConfigs] = await Promise.all([getAllBoardConfigs(), getPopularBoardConfigs()]);

  return <HomePageContent boardConfigs={boardConfigs} initialPopularConfigs={popularConfigs} />;
}
