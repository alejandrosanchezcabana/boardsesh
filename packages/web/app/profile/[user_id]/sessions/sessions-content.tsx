'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import ProfileSubPageLayout from '../components/profile-sub-page-layout';
import ActivityFeed from '@/app/components/activity-feed/activity-feed';

type ProfileSessionsContentProps = {
  userId: string;
  isAuthenticatedSSR?: boolean;
};

export default function ProfileSessionsContent({ userId, isAuthenticatedSSR }: ProfileSessionsContentProps) {
  const { status } = useSession();
  const isAuthenticated =
    status === 'authenticated' ? true : status === 'loading' ? (isAuthenticatedSSR ?? false) : false;

  return (
    <ProfileSubPageLayout>
      <ActivityFeed isAuthenticated={isAuthenticated} userId={userId} />
    </ProfileSubPageLayout>
  );
}
