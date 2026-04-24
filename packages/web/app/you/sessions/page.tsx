import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getYouSession } from '../you-auth';
import { cachedUserSessionGroupedFeed } from '@/app/lib/graphql/server-cached-client';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import ActivityFeed from '@/app/components/activity-feed/activity-feed';

export const metadata: Metadata = {
  title: 'Sessions | Boardsesh',
  robots: { index: false, follow: true },
};

export default async function YouSessionsPage() {
  const [session, authToken] = await Promise.all([getYouSession(), getServerAuthToken()]);
  if (!session?.user?.id) {
    redirect('/');
  }
  const userId = session.user.id;

  const initialFeedResult = authToken
    ? await cachedUserSessionGroupedFeed(authToken, userId).catch((err: unknown) => {
        console.error('[YouSessionsPage] Failed to fetch session feed:', err);
        return null;
      })
    : null;

  return <ActivityFeed isAuthenticated userId={userId} initialFeedResult={initialFeedResult} />;
}
