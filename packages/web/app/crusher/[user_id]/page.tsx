import React from 'react';
import { Metadata } from 'next';
import { dbz } from '@/app/lib/db/db';
import { sql } from 'drizzle-orm';
import ProfilePageContent from './profile-page-content';

type PageProps = {
  params: Promise<{ user_id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { user_id } = await params;

  try {
    const result = await dbz.execute<{
      name: string | null;
      display_name: string | null;
      avatar_url: string | null;
    }>(sql`
      SELECT u.name, p.display_name, p.avatar_url
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = ${user_id}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return {
        title: 'Profile | Boardsesh',
        description: 'View climbing profile and stats',
      };
    }

    const row = result.rows[0];
    const displayName = row.display_name || row.name || 'Crusher';
    const description = `${displayName}'s climbing profile on Boardsesh`;

    const ogParams = new URLSearchParams();
    ogParams.set('user_id', user_id);
    const ogImagePath = `/api/og/profile?${ogParams.toString()}`;

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
            url: ogImagePath,
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
        images: [ogImagePath],
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
  return <ProfilePageContent userId={user_id} />;
}
