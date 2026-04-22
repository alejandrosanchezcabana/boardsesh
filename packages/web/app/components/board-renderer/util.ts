import type { BoardDetails, BoardName } from '@/app/lib/types';
import { BOARD_IMAGE_DIMENSIONS } from '../../lib/board-data';
export { convertLitUpHoldsStringToMap } from './types';

type BuildBoardRenderUrlOptions = {
  thumbnail?: boolean;
  includeBackground?: boolean;
  variant?: 'default' | 'og';
  format?: 'webp' | 'png';
};

/**
 * Build the URL for the Rust/WASM-rendered board image.
 * Mirroring is handled via CSS (scaleX(-1)), not a separate render — halves cache variants.
 */
export const buildBoardRenderUrl = (
  boardDetails: BoardDetails,
  frames: string,
  { thumbnail, includeBackground, variant, format }: BuildBoardRenderUrlOptions = {},
) => {
  let url =
    `/api/internal/board-render?board_name=${boardDetails.board_name}` +
    `&layout_id=${boardDetails.layout_id}` +
    `&size_id=${boardDetails.size_id}` +
    `&set_ids=${boardDetails.set_ids.join(',')}` +
    `&frames=${encodeURIComponent(frames)}`;

  if (thumbnail) {
    url += '&thumbnail=1';
  }

  if (includeBackground) {
    url += '&include_background=1';
  }

  if (variant === 'og') {
    url += '&variant=og';
  }

  if (format) {
    url += `&format=${format}`;
  }

  return url;
};

export const buildOverlayUrl = (boardDetails: BoardDetails, frames: string, thumbnail?: boolean) =>
  buildBoardRenderUrl(boardDetails, frames, {
    thumbnail,
    includeBackground: true,
  });

export const buildOgBoardRenderUrl = (boardDetails: BoardDetails, frames: string) =>
  buildBoardRenderUrl(boardDetails, frames, {
    includeBackground: true,
    variant: 'og',
    format: 'png',
  });

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
