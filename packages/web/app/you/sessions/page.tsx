import React from 'react';
import { redirect } from 'next/navigation';
import { getYouSession } from '../you-auth';
import { cachedUserSessionGroupedFeed } from '@/app/lib/graphql/server-cached-client';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import ActivityFeed from '@/app/components/activity-feed/activity-feed';
import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import { getServerTranslation } from '@/app/lib/i18n/server';

export async function generateMetadata() {
  const { t, locale } = await getServerTranslation('you');
  return createNoIndexMetadata({
    title: t('metadata.sessions.title'),
    description: t('metadata.sessions.description'),
    path: '/you/sessions',
    locale,
  });
}

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
