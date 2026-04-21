import React from "react";
import { Metadata } from "next";
import { getServerAuthToken } from "@/app/lib/auth/server-auth";
import { serverMyBoards } from "@/app/lib/graphql/server-cached-client";
import { generatePlaylistMetadata } from "@/app/lib/seo/playlist-metadata";
import PlaylistDetailContent from "./playlist-detail-content";
import styles from "@/app/components/library/playlist-view.module.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playlist_uuid: string }>;
}): Promise<Metadata> {
  const { playlist_uuid } = await params;
  return generatePlaylistMetadata(playlist_uuid);
}

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ playlist_uuid: string }>;
}) {
  const { playlist_uuid } = await params;

  const authToken = await getServerAuthToken();
  const initialMyBoards = authToken ? await serverMyBoards(authToken) : null;

  return (
    <div className={styles.pageContainer}>
      <PlaylistDetailContent playlistUuid={playlist_uuid} initialMyBoards={initialMyBoards} />
    </div>
  );
}
