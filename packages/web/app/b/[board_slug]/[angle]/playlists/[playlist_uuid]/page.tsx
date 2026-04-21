import React from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { resolveBoardBySlug } from "@/app/lib/board-slug-utils";
import { constructBoardSlugPlaylistsUrl } from "@/app/lib/url-utils";
import { getServerAuthToken } from "@/app/lib/auth/server-auth";
import { serverMyBoards } from "@/app/lib/graphql/server-cached-client";
import { generatePlaylistMetadata } from "@/app/lib/seo/playlist-metadata";
import PlaylistDetailContent from "@/app/playlists/[playlist_uuid]/playlist-detail-content";
import styles from "@/app/components/library/playlist-view.module.css";

interface PlaylistDetailPageProps {
  params: Promise<{ board_slug: string; angle: string; playlist_uuid: string }>;
}

export async function generateMetadata(props: PlaylistDetailPageProps): Promise<Metadata> {
  const params = await props.params;
  return generatePlaylistMetadata(params.playlist_uuid);
}

export default async function BoardSlugPlaylistDetailPage(props: PlaylistDetailPageProps) {
  const params = await props.params;

  const board = await resolveBoardBySlug(params.board_slug);
  if (!board) {
    return notFound();
  }

  const playlistsBasePath = constructBoardSlugPlaylistsUrl(params.board_slug, Number(params.angle));

  const authToken = await getServerAuthToken();
  const initialMyBoards = authToken ? await serverMyBoards(authToken) : null;

  return (
    <div className={styles.pageContainer}>
      <PlaylistDetailContent
        playlistUuid={params.playlist_uuid}
        playlistsBasePath={playlistsBasePath}
        boardSlug={params.board_slug}
        initialMyBoards={initialMyBoards}
      />
    </div>
  );
}
