import React from 'react';
import { Metadata } from 'next';
import { getDb } from '@/app/lib/db/db';
import * as schema from '@/app/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/lib/auth/auth-options';
import { cachedUserProfileStats, cachedUserTicks } from '@/app/lib/graphql/server-cached-client';
import { SUPPORTED_BOARDS } from '@/app/lib/board-data';
import ProfilePageContent from './profile-page-content';
import { getProfileData } from './server-profile-data';
import type { LogbookEntry } from './utils/profile-constants';

type PageProps = {
  params: Promise<{ user_id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { user_id } = await params;

  try {
    const db = getDb();
    const rows = await db
      .select({
        name: schema.users.name,
        displayName: schema.userProfiles.displayName,
        avatarUrl: schema.userProfiles.avatarUrl,
      })
      .from(schema.users)
      .leftJoin(schema.userProfiles, eq(schema.userProfiles.userId, schema.users.id))
      .where(eq(schema.users.id, user_id))
      .limit(1);

    if (rows.length === 0) {
      return {
        title: 'Profile | Boardsesh',
        description: 'View climbing profile and stats',
      };
    }

    const row = rows[0];
    const displayName = row.displayName || row.name || 'Crusher';
    const description = `${displayName}'s climbing profile on Boardsesh`;

    const ogImageUrl = new URL('/api/og/profile', 'https://boardsesh.com');
    ogImageUrl.searchParams.set('user_id', user_id);

    return {
      title: `${displayName} | Boardsesh`,
      description,
      openGraph: {
        title: `${displayName} | Boardsesh`,
        description,
        type: 'profile',
        url: `/crusher/${user_id}`,
        images: [
          {
            url: ogImageUrl.toString(),
            width: 1200,
            height: 630,
            alt: `${displayName}'s climbing profile`,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${displayName} | Boardsesh`,
        description,
        images: [ogImageUrl.toString()],
      },
    };
  } catch {
    return {
      title: 'Profile | Boardsesh',
      description: 'View climbing profile and stats',
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

  // Check if user exists before fetching stats/ticks
  const initialProfile = await getProfileData(user_id, viewerUserId);

  if (!initialProfile) {
    return <ProfilePageContent userId={user_id} initialNotFound />;
  }

  // User exists — fetch stats and ticks in parallel
  const [initialProfileStats, ...ticksResults] = await Promise.all([
    cachedUserProfileStats(user_id),
    ...SUPPORTED_BOARDS.map((boardType) => cachedUserTicks(user_id, boardType)),
  ]);

  // Build allBoardsTicks record
  const initialAllBoardsTicks: Record<string, LogbookEntry[]> = {};
  SUPPORTED_BOARDS.forEach((bt, i) => {
    const ticks = ticksResults[i];
    initialAllBoardsTicks[bt] = ticks
      ? ticks.map((tick) => ({
          climbed_at: tick.climbedAt,
          difficulty: tick.difficulty,
          tries: tick.attemptCount,
          angle: tick.angle,
          status: tick.status as LogbookEntry['status'],
          layoutId: tick.layoutId,
          boardType: bt,
          climbUuid: tick.climbUuid,
        }))
      : [];
  });

  // Default board logbook
  const defaultBoard = 'kilter';
  const initialLogbook = initialAllBoardsTicks[defaultBoard] ?? [];

  return (
    <ProfilePageContent
      userId={user_id}
      initialProfile={initialProfile}
      initialProfileStats={initialProfileStats}
      initialAllBoardsTicks={initialAllBoardsTicks}
      initialLogbook={initialLogbook}
      initialIsOwnProfile={viewerUserId === user_id}
    />
  );
}
