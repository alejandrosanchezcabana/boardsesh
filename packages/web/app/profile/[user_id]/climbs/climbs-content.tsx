'use client';

import React from 'react';
import ProfileSubPageLayout from '../components/profile-sub-page-layout';
import UserClimbList from '@/app/components/climb-list/user-climb-list';

interface ClimbsContentProps {
  userId: string;
}

export default function ClimbsContent({ userId }: ClimbsContentProps) {
  return (
    <ProfileSubPageLayout userId={userId} title="Setting">
      <UserClimbList userId={userId} />
    </ProfileSubPageLayout>
  );
}
