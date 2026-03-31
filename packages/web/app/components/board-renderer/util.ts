import { BoardDetails, BoardName } from '@/app/lib/types';
import { BOARD_IMAGE_DIMENSIONS } from '../../lib/board-data';
import { LitUpHoldsMap, HOLD_STATE_MAP } from './types';

/**
 * Build the URL for the WASM-rendered overlay image.
 * Mirroring is handled via CSS (scaleX(-1)), not a separate render — halves cache variants.
 */
export const buildOverlayUrl = (boardDetails: BoardDetails, frames: string, thumbnail?: boolean) =>
  `/api/internal/board-render?board_name=${boardDetails.board_name}&layout_id=${boardDetails.layout_id}&size_id=${boardDetails.size_id}&set_ids=${boardDetails.set_ids.join(',')}&frames=${encodeURIComponent(frames)}${thumbnail ? '&thumbnail=1' : ''}`;

const USE_SELF_HOSTED_IMAGES = true;

export const getImageUrl = (imageUrl: string, board: BoardName) => {
  // If the URL already starts with /, it's a full path (e.g., MoonBoard images)
  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }

  if (USE_SELF_HOSTED_IMAGES) {
    return `/images/${board}/${imageUrl}`.replace(/\.png$/, '.avif');
  }

  return `https://api.${board}boardapp${board === 'tension' ? '2' : ''}.com/img/${imageUrl}`;
};

export const convertLitUpHoldsStringToMap = (litUpHolds: string, board: BoardName): Record<number, LitUpHoldsMap> => {
  // Split the litUpHolds string by frame delimiter (`,`), process each frame
  return litUpHolds
    .split(',')
    .filter((frame) => frame) // Filter out empty frames
    .reduce(
      (frameMap, frameString, frameIndex) => {
        // Convert each frame to a LitUpHoldsMap
        const frameHoldsMap = Object.fromEntries(
          frameString
            .split('p')
            .filter((hold) => hold) // Filter out empty hold data
            .map((holdData) => holdData.split('r').map((str) => Number(str))) // Extract holdId and stateCode
            .map(([holdId, stateCode]) => {
              if (!HOLD_STATE_MAP[board][stateCode]) {
                console.warn(
                  `HOLD_STATE_MAP is missing values for ${board} hold id: ${holdId}, missing status code: ${stateCode}.
                You probably need to update that mapping after adding support for more boards`,
                );
                return [holdId || 0, { state: `${holdId}=${stateCode}`, color: '#FFF', displayColor: '#FFF' }];
              }
              const { name, color, displayColor } = HOLD_STATE_MAP[board][stateCode];
              return [holdId, { state: name, color, displayColor: displayColor || color }];
            }),
        );
        //@ts-expect-error TODO: The warning state above is not compatible with statesmap, so we just expect error here, will deal with this later
        frameMap[frameIndex] = frameHoldsMap; // Map each frame's holds
        return frameMap;
      },
      {} as Record<number, LitUpHoldsMap>,
    );
};

export const getBoardImageDimensions = (board: BoardName, firstImage: string) =>
  BOARD_IMAGE_DIMENSIONS[board][firstImage];
