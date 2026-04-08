// Climb and Hold types
import type { MoonBoardHoldsInput } from './new-climb-feed';

export type HoldState = 'OFF' | 'STARTING' | 'FINISH' | 'HAND' | 'FOOT' | 'ANY' | 'NOT';
export type LitupHold = { state: HoldState; color: string; displayColor: string };
export type LitUpHoldsMap = Record<number, LitupHold>;

export type Climb = {
  uuid: string;
  layoutId?: number | null; // GraphQL nullable Int - layout the climb belongs to
  setter_username: string;
  name: string;
  description?: string | null;
  frames: string;
  angle: number;
  ascensionist_count: number;
  difficulty: string;
  quality_average: string;
  stars: number;
  difficulty_error: string;
  mirrored?: boolean | null; // GraphQL nullable Boolean
  benchmark_difficulty: string | null;
  userAscents?: number | null; // GraphQL nullable Int
  userAttempts?: number | null; // GraphQL nullable Int
  boardType?: string; // Populated in multi-board contexts
};

// Input type for Climb (matches GraphQL ClimbInput)
export type ClimbInput = {
  uuid: string;
  setter_username: string;
  name: string;
  description?: string | null;
  frames: string;
  angle: number;
  ascensionist_count: number;
  difficulty: string;
  quality_average: string;
  stars: number;
  difficulty_error: string;
  mirrored?: boolean | null;
  benchmark_difficulty?: string | null;
  userAscents?: number | null;
  userAttempts?: number | null;
};

export type ClimbSearchInput = {
  boardName: string;
  layoutId: number;
  sizeId: number;
  setIds: string;
  angle: number;
  // Pagination
  page?: number;
  pageSize?: number;
  // Filters
  gradeAccuracy?: string;
  minGrade?: number;
  maxGrade?: number;
  minAscents?: number;
  sortBy?: string;
  sortOrder?: string;
  name?: string;
  setter?: string[];
  setterId?: number;
  onlyBenchmarks?: boolean;
  onlyTallClimbs?: boolean;
  // Hold filters - accepts any HoldState for filtering climbs by hold usage
  holdsFilter?: Record<string, HoldState>;
  // Personal progress filters
  hideAttempted?: boolean;
  hideCompleted?: boolean;
  showOnlyAttempted?: boolean;
  showOnlyCompleted?: boolean;
  onlyDrafts?: boolean;
};

/**
 * Search params that require a userId to have any effect on query results.
 * Used by caching layers (Redis, CDN, SSR) to decide whether results are
 * user-specific or can be shared across all users.
 *
 * Type-checked against ClimbSearchInput so adding/removing a field here
 * causes a compile error if the type doesn't match.
 */
export const USER_SPECIFIC_SEARCH_PARAMS = [
  'hideAttempted',
  'hideCompleted',
  'showOnlyAttempted',
  'showOnlyCompleted',
  'onlyDrafts',
] as const satisfies ReadonlyArray<keyof ClimbSearchInput>;

export type ClimbSearchResult = {
  climbs: Climb[];
  totalCount: number;
  hasMore: boolean;
};

export type SaveClimbInput = {
  boardType: string;
  layoutId: number;
  name: string;
  description?: string | null;
  isDraft: boolean;
  frames: string;
  framesCount?: number | null;
  framesPace?: number | null;
  angle: number;
};

export type SaveMoonBoardClimbInput = {
  boardType: string;
  layoutId: number;
  name: string;
  description?: string | null;
  holds: MoonBoardHoldsInput;
  angle: number;
  isDraft?: boolean | null;
  userGrade?: string | null;
  isBenchmark?: boolean | null;
  setter?: string | null;
};

export type SaveClimbResult = {
  uuid: string;
  synced: boolean;
};
