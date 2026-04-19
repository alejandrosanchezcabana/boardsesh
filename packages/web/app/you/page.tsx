import React from 'react';
import { Metadata } from 'next';
import { getProfileData } from '../profile/[user_id]/server-profile-data';
import { fetchProfileStatsData } from '../profile/[user_id]/server-profile-stats';
import { getYouSession } from './you-auth';
import YouProgressContent from './you-progress-content';

export const metadata: Metadata = {
  title: 'You | Boardsesh',
  description: 'Your climbing dashboard',
  robots: { index: false, follow: true },
};

export default async function YouPage() {
  // Layout already redirects unauthenticated users; session is guaranteed here.
  const session = await getYouSession();
  const userId = session!.user!.id;

  const [initialProfile, statsData] = await Promise.all([
    getProfileData(userId, userId),
    fetchProfileStatsData(userId),
  ]);

  return (
    <YouProgressContent
      userId={userId}
      initialProfile={initialProfile}
      initialProfileStats={statsData.initialProfileStats}
      initialAllBoardsTicks={statsData.initialAllBoardsTicks}
      initialLogbook={statsData.initialLogbook}
    />
  );
}
