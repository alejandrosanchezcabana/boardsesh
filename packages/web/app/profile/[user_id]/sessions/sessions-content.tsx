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
  let isAuthenticated: boolean;
  if (status === 'authenticated') {
    isAuthenticated = true;
  } else if (status === 'loading') {
    isAuthenticated = isAuthenticatedSSR ?? false;
  } else {
    isAuthenticated = false;
  }

  return (
    <ProfileSubPageLayout>
      <ActivityFeed isAuthenticated={isAuthenticated} userId={userId} />
    </ProfileSubPageLayout>
  );
}
