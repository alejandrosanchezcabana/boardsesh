import React from 'react';
import { Metadata } from 'next';
import { getYouSession } from '../you-auth';
import { serverUserSessionGroupedFeed } from '@/app/lib/graphql/server-cached-client';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import ActivityFeed from '@/app/components/activity-feed/activity-feed';

export const metadata: Metadata = {
  title: 'Sessions | Boardsesh',
  robots: { index: false, follow: true },
};

export default async function YouSessionsPage() {
  // Layout already redirects unauthenticated users; session is guaranteed here.
  const [session, authToken] = await Promise.all([getYouSession(), getServerAuthToken()]);
  const userId = session!.user!.id;

  const initialFeedResult = authToken
    ? await serverUserSessionGroupedFeed(authToken, userId).catch((err: unknown) => {
        console.error('[YouSessionsPage] Failed to fetch session feed:', err);
        return null;
      })
    : null;

  return (
    <ActivityFeed
      isAuthenticated={true}
      userId={userId}
      initialFeedResult={initialFeedResult}
    />
  );
}
