import type { UserBoard } from '@boardsesh/shared-schema';
import { BoardName, BoardDetails } from './types';
import {
  getSizesForLayoutId,
  getSetsForLayoutAndSize,
  getBoardDetails,
  LAYOUTS,
} from './board-constants';
import { getMoonBoardDetails, MOONBOARD_LAYOUTS, MOONBOARD_SETS, MoonBoardLayoutKey } from './moonboard-config';

/**
 * Derive BoardDetails for a playlist using the largest available size and all sets.
 * Used when viewing playlists outside of a board session.
 */
export function getBoardDetailsForPlaylist(
  boardType: string,
  layoutId: number | null | undefined,
): BoardDetails | null {
  const boardName = boardType as BoardName;

  if (boardName === 'moonboard') {
    return getMoonBoardDetailsForPlaylist(layoutId);
  }

  const effectiveLayoutId = layoutId ?? getDefaultLayoutForBoard(boardName);
  if (!effectiveLayoutId) return null;

  const sizes = getSizesForLayoutId(boardName, effectiveLayoutId);
  if (sizes.length === 0) return null;

  // Pick the size with the largest area
  const largest = sizes.reduce((best, size) => {
    const area = (size.edgeRight - size.edgeLeft) * (size.edgeTop - size.edgeBottom);
    const bestArea = (best.edgeRight - best.edgeLeft) * (best.edgeTop - best.edgeBottom);
    return area > bestArea ? size : best;
  });

  const sets = getSetsForLayoutAndSize(boardName, effectiveLayoutId, largest.id);
  if (sets.length === 0) return null;

  const setIds = sets.map((s) => s.id);

  try {
    return getBoardDetails({
      board_name: boardName,
      layout_id: effectiveLayoutId,
      size_id: largest.id,
      set_ids: setIds,
    });
  } catch {
    return null;
  }
}

function getMoonBoardDetailsForPlaylist(layoutId: number | null | undefined): BoardDetails | null {
  const effectiveLayoutId = layoutId ?? MOONBOARD_LAYOUTS['moonboard-2024'].id;

  const layoutEntry = Object.entries(MOONBOARD_LAYOUTS).find(
    ([, layout]) => layout.id === effectiveLayoutId,
  );
  if (!layoutEntry) return null;

  const [layoutKey] = layoutEntry;
  const sets = MOONBOARD_SETS[layoutKey as MoonBoardLayoutKey] || [];
  const setIds = sets.map((s) => s.id);

  try {
    return getMoonBoardDetails({
      layout_id: effectiveLayoutId,
      set_ids: setIds,
    });
  } catch {
    return null;
  }
}

/**
 * Get the default layout ID for a board type.
 * Returns the first layout in the LAYOUTS map.
 */
export function getDefaultLayoutForBoard(boardType: string): number | null {
  if (boardType === 'moonboard') {
    return MOONBOARD_LAYOUTS['moonboard-2024'].id;
  }

  const boardLayouts = LAYOUTS[boardType as BoardName];
  if (!boardLayouts) return null;

  const ids = Object.keys(boardLayouts).map(Number);
  return ids.length > 0 ? ids[0] : null;
}

/** Default angle per board type. Kilter/MoonBoard default to 40, Tension to 40 (all support it). */
const DEFAULT_ANGLES: Record<string, number> = {
  kilter: 40,
  tension: 40,
  moonboard: 40,
};
const FALLBACK_ANGLE = 40;

/**
 * Get a default angle for a board type.
 */
export function getDefaultAngleForBoard(boardType: string): number {
  return DEFAULT_ANGLES[boardType] ?? FALLBACK_ANGLE;
}

/**
 * Get BoardDetails for a UserBoard by resolving its board type, layout, size, and sets.
 */
export function getUserBoardDetails(board: UserBoard): BoardDetails | null {
  try {
    const setIds = board.setIds.split(',').map(Number);
    if (board.boardType === 'moonboard') {
      return getMoonBoardDetails({ layout_id: board.layoutId, set_ids: setIds }) as BoardDetails;
    }
    return getBoardDetails({
      board_name: board.boardType as BoardName,
      layout_id: board.layoutId,
      size_id: board.sizeId,
      set_ids: setIds,
    });
  } catch {
    return null;
  }
}
