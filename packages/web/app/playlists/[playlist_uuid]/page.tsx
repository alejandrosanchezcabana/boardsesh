import React from 'react';
import { Metadata } from 'next';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import { serverMyBoards } from '@/app/lib/graphql/server-cached-client';
import { dbz } from '@/app/lib/db/db';
import { sql } from 'drizzle-orm';
import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import PlaylistDetailContent from './playlist-detail-content';
import styles from '@/app/components/library/playlist-view.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playlist_uuid: string }>;
}): Promise<Metadata> {
  const { playlist_uuid } = await params;

  try {
    const result = await dbz.execute<{
      name: string;
      description: string | null;
      is_public: boolean;
      climb_count: number;
    }>(sql`
      SELECT p.name, p.description, p.is_public,
             (SELECT COUNT(*) FROM playlist_climbs pc WHERE pc.playlist_id = p.id) as climb_count
      FROM playlists p
      WHERE p.uuid = ${playlist_uuid}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return { title: 'Playlist | Boardsesh', description: 'View playlist details and climbs' };
    }

    const playlist = result.rows[0];

    if (!playlist.is_public) {
      return createNoIndexMetadata({
        title: 'Private Playlist',
        description: 'This playlist is private',
        imagePath: null,
      });
    }

    const name = playlist.name;
    const climbCount = Number(playlist.climb_count);
    const description = playlist.description || `A climbing playlist on Boardsesh with ${climbCount} climb${climbCount === 1 ? '' : 's'}`;
    const title = `${name} | Boardsesh`;

    const ogImagePath = `/api/og/playlist?uuid=${playlist_uuid}`;
    const canonicalUrl = `/playlists/${playlist_uuid}`;

    return {
      title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title,
        description,
        type: 'website',
        url: canonicalUrl,
        images: [{ url: ogImagePath, width: 1200, height: 630, alt: `${name} playlist` }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImagePath],
      },
    };
  } catch {
    return { title: 'Playlist | Boardsesh', description: 'View playlist details and climbs' };
  }
}

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ playlist_uuid: string }>;
}) {
  const { playlist_uuid } = await params;

  // Fetch user's boards server-side so the filter strip renders populated on first paint
  // and the current-queue fallback can seed the selection without flashing "All Boards".
  const authToken = await getServerAuthToken();
  const initialMyBoards = authToken ? await serverMyBoards(authToken) : null;

  return (
    <div className={styles.pageContainer}>
      <PlaylistDetailContent playlistUuid={playlist_uuid} initialMyBoards={initialMyBoards} />
    </div>
  );
}
