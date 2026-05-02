import React from 'react';
import { redirect } from 'next/navigation';
import { getProfileData } from '../profile/[user_id]/server-profile-data';
import { fetchProfileStatsData } from '../profile/[user_id]/server-profile-stats';
import { getYouSession } from './you-auth';
import YouProgressContent from './you-progress-content';
import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import { getServerTranslation } from '@/app/lib/i18n/server';

export async function generateMetadata() {
  const { t, locale } = await getServerTranslation('you');
  return createNoIndexMetadata({
    title: t('metadata.dashboard.title'),
    description: t('metadata.dashboard.description'),
    path: '/you',
    locale,
  });
}

export default async function YouPage() {
  const session = await getYouSession();
  if (!session?.user?.id) {
    redirect('/');
  }
  const userId = session.user.id;

  const [initialProfile, statsData] = await Promise.all([
    getProfileData(userId, userId),
    fetchProfileStatsData(userId),
  ]);

  return (
    <YouProgressContent
      userId={userId}
      initialProfile={initialProfile}
      initialProfileStats={statsData.initialProfileStats}
      initialPercentile={statsData.initialPercentile}
      initialAllBoardsTicks={statsData.initialAllBoardsTicks}
      initialLogbook={statsData.initialLogbook}
    />
  );
}
