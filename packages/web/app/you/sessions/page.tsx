import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth-options';
import { cachedUserProfileStats, cachedUserTicks } from '@/app/lib/graphql/server-cached-client';
import { SUPPORTED_BOARDS } from '@/app/lib/board-data';
import { getProfileData } from '../../profile/[user_id]/server-profile-data';
import type { LogbookEntry } from '../../profile/[user_id]/utils/profile-constants';
import YouPageContent from '../you-page-content';

export const metadata: Metadata = {
  title: 'Sessions | Boardsesh',
  robots: { index: false, follow: true },
};

export default async function YouSessionsPage() {
  const authToken = await getServerAuthToken();
  if (!authToken) {
    redirect('/');
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/');
  }

  const userId = session.user.id;

  const [initialProfile, initialProfileStats, ...ticksResults] = await Promise.all([
    getProfileData(userId, userId),
    cachedUserProfileStats(userId),
    ...SUPPORTED_BOARDS.map((boardType) => cachedUserTicks(userId, boardType)),
  ]);

  const initialAllBoardsTicks: Record<string, LogbookEntry[]> = {};
  SUPPORTED_BOARDS.forEach((bt, i) => {
    const ticks = ticksResults[i];
    initialAllBoardsTicks[bt] = ticks
      ? ticks.map((tick) => ({
          climbed_at: tick.climbedAt,
          difficulty: tick.difficulty,
          tries: tick.attemptCount,
          angle: tick.angle,
          status: tick.status as LogbookEntry['status'],
          layoutId: tick.layoutId,
          boardType: bt,
          climbUuid: tick.climbUuid,
        }))
      : [];
  });

  const initialLogbook = initialAllBoardsTicks['kilter'] ?? [];

  return (
    <YouPageContent
      userId={userId}
      initialProfile={initialProfile}
      initialProfileStats={initialProfileStats}
      initialAllBoardsTicks={initialAllBoardsTicks}
      initialLogbook={initialLogbook}
    />
  );
}
