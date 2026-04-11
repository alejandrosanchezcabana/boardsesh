import React from 'react';
import { getServerAuthToken } from '@/app/lib/auth/server-auth';
import { serverMyBoards, serverUserPlaylists, cachedDiscoverPlaylists } from '@/app/lib/graphql/server-cached-client';
import LibraryPageContent from '@/app/playlists/library-page-content';
import styles from '@/app/components/library/library.module.css';
import { createPageMetadata } from '@/app/lib/seo/metadata';

export const metadata = createPageMetadata({
  title: 'Logbook',
  description: 'Track your climbing history and manage your playlists after signing in.',
  path: '/logbook',
});

export default async function LogbookPage() {
  const authToken = await getServerAuthToken();

  const [initialMyBoards, initialPlaylists, initialDiscoverPlaylists] = await Promise.all([
    authToken ? serverMyBoards(authToken) : null,
    authToken ? serverUserPlaylists(authToken) : null,
    cachedDiscoverPlaylists(),
  ]);

  return (
    <div className={styles.pageContainer}>
      <LibraryPageContent
        playlistsBasePath="/playlists"
        initialMyBoards={initialMyBoards}
        initialPlaylists={initialPlaylists}
        initialDiscoverPlaylists={initialDiscoverPlaylists}
      />
    </div>
  );
}
