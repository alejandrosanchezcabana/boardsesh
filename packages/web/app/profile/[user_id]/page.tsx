import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth-options';
import ProfilePageContent from './profile-page-content';
import { getProfileData } from './server-profile-data';
import { fetchProfileStatsData } from './server-profile-stats';
import { buildVersionedOgImagePath, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/app/lib/seo/og';
import { getProfileOgSummary } from '@/app/lib/seo/dynamic-og-data';

type PageProps = {
  params: Promise<{ user_id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { user_id } = await params;

  try {
    const summary = await getProfileOgSummary(user_id);

    if (!summary) {
      return {
        title: 'Profile Not Found | Boardsesh',
        description: 'This climbing profile could not be found.',
        robots: { index: false, follow: false },
      };
    }

    const displayName = summary.displayName;
    const description = `${displayName}'s climbing profile on Boardsesh`;
    const ogImagePath = buildVersionedOgImagePath('/api/og/profile', { user_id }, summary.version);

    return {
      title: `${displayName} | Boardsesh`,
      description,
      alternates: { canonical: `/profile/${user_id}` },
      openGraph: {
        title: `${displayName} | Boardsesh`,
        description,
        type: 'profile',
        url: `/profile/${user_id}`,
        images: [
          {
            url: ogImagePath,
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            alt: `${displayName}'s climbing profile`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${displayName} | Boardsesh`,
        description,
        images: [ogImagePath],
      },
    };
  } catch {
    return {
      title: 'Profile | Boardsesh',
      description: 'View climbing profile and stats',
      alternates: { canonical: `/profile/${user_id}` },
    };
  }
}

export default async function ProfilePage({ params }: PageProps) {
  const { user_id } = await params;

  // Only check session if auth cookie exists (skip for anonymous visitors)
  const authToken = await getServerAuthToken();
  let viewerUserId: string | undefined;
  if (authToken) {
    const session = await getServerSession(authOptions);
    viewerUserId = session?.user?.id;
  }

  const initialProfile = await getProfileData(user_id, viewerUserId);

  if (!initialProfile) {
    notFound();
  }

  const statsData = await fetchProfileStatsData(user_id);

  return (
    <ProfilePageContent
      userId={user_id}
      initialProfile={initialProfile}
      initialProfileStats={statsData.initialProfileStats}
      initialAllBoardsTicks={statsData.initialAllBoardsTicks}
      initialLogbook={statsData.initialLogbook}
      initialIsOwnProfile={viewerUserId === user_id}
    />
  );
}
