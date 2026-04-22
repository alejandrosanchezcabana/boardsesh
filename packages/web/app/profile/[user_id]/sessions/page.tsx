import React from 'react';
import type { Metadata } from 'next';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import ProfileSessionsContent from './sessions-content';

type PageProps = { params: Promise<{ user_id: string }> };

export const metadata: Metadata = {
  title: 'Sessions | Boardsesh',
  robots: { index: false, follow: true },
};

export default async function ProfileSessionsPage({ params }: PageProps) {
  const { user_id } = await params;
  const authToken = await getServerAuthToken();
  return <ProfileSessionsContent userId={user_id} isAuthenticatedSSR={!!authToken} />;
}
