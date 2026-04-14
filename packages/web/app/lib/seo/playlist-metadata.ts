import { Metadata } from 'next';
import { dbz } from '@/app/lib/db/db';
import { sql } from 'drizzle-orm';
import { createNoIndexMetadata } from './metadata';

const FALLBACK_METADATA: Metadata = {
  title: 'Playlist | Boardsesh',
  description: 'View playlist details and climbs',
};

export async function generatePlaylistMetadata(playlistUuid: string): Promise<Metadata> {
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
      WHERE p.uuid = ${playlistUuid}
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return FALLBACK_METADATA;
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

    const ogImagePath = `/api/og/playlist?uuid=${playlistUuid}`;
    const canonicalUrl = `/playlists/${playlistUuid}`;

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
    return FALLBACK_METADATA;
  }
}
