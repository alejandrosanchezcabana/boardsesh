import { BoardDetails, BoardName } from '@/app/lib/types';
import { BOARD_IMAGE_DIMENSIONS } from '../../lib/board-data';
export { convertLitUpHoldsStringToMap } from './types';

/**
 * Build the URL for the WASM-rendered overlay image.
 * Mirroring is handled via CSS (scaleX(-1)), not a separate render — halves cache variants.
 */
export const buildOverlayUrl = (boardDetails: BoardDetails, frames: string, thumbnail?: boolean) =>
  `/api/internal/board-render?board_name=${boardDetails.board_name}&layout_id=${boardDetails.layout_id}&size_id=${boardDetails.size_id}&set_ids=${boardDetails.set_ids.join(',')}&frames=${encodeURIComponent(frames)}${thumbnail ? '&thumbnail=1' : ''}&include_background=1`;

const USE_SELF_HOSTED_IMAGES = true;

/** Insert /thumbs/ before the filename in a WebP path, or return as-is. */
const toThumbUrl = (webpUrl: string) => {
  const lastSlash = webpUrl.lastIndexOf('/');
  return `${webpUrl.substring(0, lastSlash)}/thumbs${webpUrl.substring(lastSlash)}`;
};

export const getImageUrl = (imageUrl: string, board: BoardName, thumbnail?: boolean) => {
  // Absolute path (e.g. MoonBoard images already prefixed with /images/moonboard/...)
  if (imageUrl.startsWith('/')) {
    const webpUrl = imageUrl.replace(/\.png$/, '.webp');
    return thumbnail ? toThumbUrl(webpUrl) : webpUrl;
  }

  if (USE_SELF_HOSTED_IMAGES) {
    const webpUrl = `/images/${board}/${imageUrl}`.replace(/\.png$/, '.webp');
    return thumbnail ? toThumbUrl(webpUrl) : webpUrl;
  }

  return `https://api.${board}boardapp${board === 'tension' ? '2' : ''}.com/img/${imageUrl}`;
};

export const getBoardImageDimensions = (board: BoardName, firstImage: string) =>
  BOARD_IMAGE_DIMENSIONS[board][firstImage];
