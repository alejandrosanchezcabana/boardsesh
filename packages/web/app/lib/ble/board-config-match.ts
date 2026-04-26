import type { BoardDetails } from '@/app/lib/types';
import type { ResolvedBoardEntry } from './resolve-serials';

/**
 * Normalise a comma-separated set_ids string to a sorted, deduped representation
 * so order/whitespace differences don't trigger spurious mismatches.
 */
function normaliseSetIds(setIds: string): string {
  return [
    ...new Set(
      setIds
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  ]
    .sort()
    .join(',');
}

export type ResolvedBoardConfig = {
  boardName: string;
  layoutId: number;
  sizeId: number;
  setIds: string;
  /** Saved-board default angle, when the entry came from `userBoards`. Recorded entries don't carry an angle. */
  angle?: number | null;
  /** When the entry is linked to a saved board, its slug — used to build /b/{slug}/... URLs. */
  boardSlug?: string | null;
};

/** Extract a unified config shape from either kind of resolved entry. */
export function configFromResolvedEntry(entry: ResolvedBoardEntry): ResolvedBoardConfig {
  if (entry.kind === 'saved') {
    return {
      boardName: entry.board.boardType,
      layoutId: entry.board.layoutId,
      sizeId: entry.board.sizeId,
      setIds: entry.board.setIds,
      angle: entry.board.angle,
      boardSlug: entry.board.slug,
    };
  }
  return {
    boardName: entry.config.boardName,
    layoutId: entry.config.layoutId,
    sizeId: entry.config.sizeId,
    setIds: entry.config.setIds,
    boardSlug: entry.config.boardSlug,
  };
}

/**
 * Whether the resolved config for a serial matches the user's current board route.
 * Angle is excluded — the same physical controller is used at multiple angles.
 */
export function matchesBoardDetails(config: ResolvedBoardConfig, current: BoardDetails): boolean {
  return (
    config.boardName === current.board_name &&
    config.layoutId === current.layout_id &&
    config.sizeId === current.size_id &&
    normaliseSetIds(config.setIds) === normaliseSetIds(current.set_ids.join(','))
  );
}
