import React from 'react';
import type { Metadata } from 'next';
import { dbz } from '@/app/lib/db/db';
import { sql } from 'drizzle-orm';
import SetterProfileContent from './setter-profile-content';
import styles from '@/app/components/library/playlist-view.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ setter_username: string }>;
}): Promise<Metadata> {
  const { setter_username } = await params;
  const username = decodeURIComponent(setter_username);

  try {
    const result = await dbz.execute<{
      display_name: string | null;
      name: string | null;
    }>(sql`
      SELECT p.display_name, u.name
      FROM user_board_mappings ubm
      JOIN users u ON u.id = ubm.user_id
      LEFT JOIN user_profiles p ON p.user_id = ubm.user_id
      WHERE ubm.board_username = ${username}
      LIMIT 1
    `);

    const displayName = result.rows[0]?.display_name || result.rows[0]?.name || username;
    const ogImagePath = `/api/og/setter?username=${encodeURIComponent(setter_username)}`;
    const title = `${displayName} - Setter | Boardsesh`;
    const description = `Climbs created by ${displayName} on Boardsesh`;
    const canonicalUrl = `/setter/${encodeURIComponent(setter_username)}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        url: canonicalUrl,
        images: [{ url: ogImagePath, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImagePath],
      },
    };
  } catch {
    return {
      title: 'Setter Profile | Boardsesh',
      description: 'View setter profile and climbs on Boardsesh',
    };
  }
}

export default async function SetterProfilePage({
  params,
}: {
  params: Promise<{ setter_username: string }>;
}) {
  const { setter_username } = await params;

  return (
    <div className={styles.pageContainer}>
      <SetterProfileContent username={decodeURIComponent(setter_username)} />
    </div>
  );
}
