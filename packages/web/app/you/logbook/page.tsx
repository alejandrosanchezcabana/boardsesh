import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import LogbookFeed from '@/app/components/library/logbook-feed';
import LogbookLoading from './loading';
import { cachedUserProfileStats } from '@/app/lib/graphql/server-cached-client';
import { getYouSession } from '../you-auth';

export const metadata: Metadata = {
  title: 'Logbook | Boardsesh',
  robots: { index: false, follow: true },
};

export default async function YouLogbookPage() {
  const session = await getYouSession();
  if (!session?.user?.id) {
    redirect('/');
  }
  const userId = session.user.id;
  const profileStats = await cachedUserProfileStats(userId);
  const layoutStats = profileStats?.layoutStats ?? [];

  return (
    <Suspense fallback={<LogbookLoading />}>
      <LogbookFeed layoutStats={layoutStats} loadingLayoutStats={false} />
    </Suspense>
  );
}
