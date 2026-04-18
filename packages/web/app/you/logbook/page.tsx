import React, { Suspense } from 'react';
import { Metadata } from 'next';
import LogbookFeed from '@/app/components/library/logbook-feed';
import { cachedUserProfileStats } from '@/app/lib/graphql/server-cached-client';
import { getYouSession } from '../you-auth';

export const metadata: Metadata = {
  title: 'Logbook | Boardsesh',
  robots: { index: false, follow: true },
};

export default async function YouLogbookPage() {
  const session = await getYouSession();
  const userId = session!.user!.id;
  const profileStats = await cachedUserProfileStats(userId);
  const layoutStats = profileStats?.layoutStats ?? [];

  return (
    <Suspense>
      <LogbookFeed layoutStats={layoutStats} loadingLayoutStats={false} />
    </Suspense>
  );
}
