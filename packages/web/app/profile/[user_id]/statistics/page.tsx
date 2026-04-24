import React from 'react';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth-options';
import { fetchProfileStatsData } from '../server-profile-stats';
import AnalyticsContent from './analytics-content';

type PageProps = { params: Promise<{ user_id: string }> };

export const metadata: Metadata = {
  title: 'Statistics | Boardsesh',
  robots: { index: false, follow: true },
};

export default async function ProfileStatisticsPage({ params }: PageProps) {
  const { user_id } = await params;
  const session = await getServerSession(authOptions);
  const viewerUserId = session?.user?.id;

  const statsData = await fetchProfileStatsData(user_id);

  return (
    <AnalyticsContent
      userId={user_id}
      initialProfileStats={statsData.initialProfileStats}
      initialPercentile={statsData.initialPercentile}
      initialAllBoardsTicks={statsData.initialAllBoardsTicks}
      initialLogbook={statsData.initialLogbook}
      initialIsOwnProfile={viewerUserId === user_id}
    />
  );
}
