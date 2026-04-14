import React from 'react';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import { serverMyBoards, serverUserPlaylists, cachedDiscoverPlaylists } from '@/app/lib/graphql/server-cached-client';
import LibraryPageContent from './library-page-content';
import { getBoardDetailsForPlaylist } from '@/app/lib/board-config-for-playlist';
import { getImageUrl } from '@/app/components/board-renderer/util';
import styles from '@/app/components/library/library.module.css';
import { createPageMetadata } from '@/app/lib/seo/metadata';

export const metadata = createPageMetadata({
  title: 'Discover Climbing Playlists',
  description: 'Discover public climbing playlists and manage your own after signing in.',
  path: '/playlists',
});

export default async function PlaylistsPage() {
  // SSR: fetch boards, playlists (unfiltered), and discover data in parallel
  const authToken = await getServerAuthToken();

  const [initialMyBoards, initialPlaylists, initialDiscoverPlaylists] = await Promise.all([
    authToken ? serverMyBoards(authToken) : null,
    authToken ? serverUserPlaylists(authToken) : null,
    cachedDiscoverPlaylists(),
  ]);

  // Compute LCP preload: first playlist's board thumbnail image
  const firstPlaylist = initialPlaylists?.[0] ?? initialDiscoverPlaylists?.popular?.[0];
  let lcpPreloadUrl: string | null = null;
  if (firstPlaylist) {
    const boardDetails = getBoardDetailsForPlaylist(firstPlaylist.boardType, firstPlaylist.layoutId);
    if (boardDetails) {
      const firstImage = Object.keys(boardDetails.images_to_holds)[0];
      if (firstImage) {
        lcpPreloadUrl = getImageUrl(firstImage, boardDetails.board_name, true);
      }
    }
  }

  return (
    <>
      {lcpPreloadUrl && (
        <link rel="preload" as="image" href={lcpPreloadUrl} fetchPriority="high" />
      )}
      <div className={styles.pageContainer}>
        <LibraryPageContent
          initialMyBoards={initialMyBoards}
          initialPlaylists={initialPlaylists}
          initialDiscoverPlaylists={initialDiscoverPlaylists}
        />
      </div>
    </>
  );
}
