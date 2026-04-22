import type { Metadata } from 'next';
import { createNoIndexMetadata } from './metadata';
import { buildVersionedOgImagePath, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from './og';
import { getPlaylistOgSummary } from './dynamic-og-data';

const FALLBACK_METADATA: Metadata = {
  title: 'Playlist | Boardsesh',
  description: 'View playlist details and climbs',
};

export async function generatePlaylistMetadata(playlistUuid: string): Promise<Metadata> {
  try {
    const playlist = await getPlaylistOgSummary(playlistUuid);

    if (!playlist) {
      return FALLBACK_METADATA;
    }

    if (!playlist.isPublic) {
      return createNoIndexMetadata({
        title: 'Private Playlist',
        description: 'This playlist is private',
        imagePath: null,
      });
    }

    const name = playlist.name;
    const climbCount = playlist.climbCount;
    const description =
      playlist.description || `A climbing playlist on Boardsesh with ${climbCount} climb${climbCount === 1 ? '' : 's'}`;
    const title = `${name} | Boardsesh`;

    const ogImagePath = buildVersionedOgImagePath('/api/og/playlist', { uuid: playlistUuid }, playlist.version);
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
        images: [
          {
            url: ogImagePath,
            width: OG_IMAGE_WIDTH,
            height: OG_IMAGE_HEIGHT,
            alt: `${name} playlist`,
          },
        ],
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
