import type { BoardDetails, BoardName } from '@/app/lib/types';
import { getBoardDetails } from '@/app/lib/board-constants';
import { constructBoardSlugListUrl, constructClimbListWithSlugs } from '@/app/lib/url-utils';
import type { ResolvedBoardEntry } from './resolve-serials';

/**
 * Parse a comma-separated set_ids string into a number[]. Accepts an array
 * directly (passthrough) so call sites that already have the normalised form
 * can share this helper.
 */
export function parseSetIds(setIds: string | number[]): number[] {
  if (Array.isArray(setIds)) return setIds;
  return setIds
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

/**
 * Normalise a comma-separated set_ids string to a sorted, deduped representation
 * so order/whitespace differences don't trigger spurious mismatches.
 */
export function normaliseSetIds(setIds: string): string {
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

/**
 * Build the climb-list URL the user should land on when they choose
 * "Switch to correct config" in the BoardConfigMismatchDialog.
 *
 * Prefers `/b/{slug}/{angle}/list` when the entry is linked to a saved board.
 * Falls back to the traditional climb-list URL derived from layout/size/set
 * names. Returns null if no resolvable URL exists for the config.
 */
export function buildSwitchUrl(config: ResolvedBoardConfig, currentAngle: number): string | null {
  const angle = config.angle ?? currentAngle;
  if (config.boardSlug) {
    return constructBoardSlugListUrl(config.boardSlug, angle);
  }
  try {
    const details = getBoardDetails({
      board_name: config.boardName as BoardName,
      layout_id: config.layoutId,
      size_id: config.sizeId,
      set_ids: parseSetIds(config.setIds),
    });
    if (details.layout_name && details.size_name && details.set_names) {
      return constructClimbListWithSlugs(
        details.board_name,
        details.layout_name,
        details.size_name,
        details.size_description,
        details.set_names,
        angle,
      );
    }
  } catch {
    // Fall through.
  }
  return null;
}
