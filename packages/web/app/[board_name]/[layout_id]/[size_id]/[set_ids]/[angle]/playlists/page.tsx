import React from 'react';
import { notFound } from 'next/navigation';
import { BoardRouteParameters } from '@/app/lib/types';
import { parseBoardRouteParamsWithSlugs } from '@/app/lib/url-utils.server';
import { Metadata } from 'next';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import { serverMyBoards, serverUserPlaylists, cachedDiscoverPlaylists } from '@/app/lib/graphql/server-cached-client';
import LibraryPageContent from '@/app/playlists/library-page-content';
import { getBoardDetailsForPlaylist } from '@/app/lib/board-config-for-playlist';
import { getImageUrl } from '@/app/components/board-renderer/util';
import styles from '@/app/components/library/library.module.css';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Playlists | Boardsesh',
    description: 'View and manage your climb playlists',
  };
}

export default async function PlaylistsPage(props: { params: Promise<BoardRouteParameters> }) {
  const params = await props.params;

  try {
    // Validate route params (throws if invalid board/layout/size/set combination)
    const parsed = await parseBoardRouteParamsWithSlugs(params);
    const playlistsBasePath = `/${params.board_name}/${params.layout_id}/${params.size_id}/${params.set_ids}/${params.angle}/playlists`;

    // SSR: fetch boards, playlists, and discover data in parallel
    const authToken = await getServerAuthToken();
    const playlistFilter = { boardType: parsed.board_name, layoutId: parsed.layout_id };

    const [initialMyBoards, initialPlaylists, initialDiscoverPlaylists] = await Promise.all([
      authToken ? serverMyBoards(authToken) : null,
      authToken ? serverUserPlaylists(authToken, playlistFilter) : null,
      cachedDiscoverPlaylists(playlistFilter),
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
            playlistsBasePath={playlistsBasePath}
            initialMyBoards={initialMyBoards}
            initialPlaylists={initialPlaylists}
            initialDiscoverPlaylists={initialDiscoverPlaylists}
          />
        </div>
      </>
    );
  } catch (error) {
    console.error('Error loading playlists page:', error);
    notFound();
  }
}
