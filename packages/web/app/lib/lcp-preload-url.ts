import { getBoardDetailsForPlaylist } from "./board-config-for-playlist";
import { getImageUrl } from "@/app/components/board-renderer/util";

/**
 * Compute the thumbnail URL for the first playlist's board image.
 * Used in server components to emit a `<link rel="preload">` for the LCP image.
 */
export function getPlaylistLcpPreloadUrl(
  playlist: { boardType: string; layoutId?: number | null } | undefined | null,
): string | null {
  if (!playlist) return null;

  const boardDetails = getBoardDetailsForPlaylist(playlist.boardType, playlist.layoutId);
  if (!boardDetails) return null;

  const firstImage = Object.keys(boardDetails.images_to_holds)[0];
  if (!firstImage) return null;

  return getImageUrl(firstImage, boardDetails.board_name, true);
}
