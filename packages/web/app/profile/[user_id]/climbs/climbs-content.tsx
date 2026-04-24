'use client';

import React from 'react';
import ProfileSubPageLayout from '../components/profile-sub-page-layout';
import UserClimbList from '@/app/components/climb-list/user-climb-list';

type ClimbsContentProps = {
  userId: string;
};

export default function ClimbsContent({ userId }: ClimbsContentProps) {
  return (
    <ProfileSubPageLayout>
      <UserClimbList userId={userId} />
    </ProfileSubPageLayout>
  );
}
