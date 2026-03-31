import type { BoardName, HoldState } from '@boardsesh/shared-schema';

/**
 * Route parameters identifying a specific board configuration.
 */
export interface BoardRouteParams {
  board_name: BoardName;
  layout_id: number;
  size_id: number;
  set_ids: number[];
  angle: number;
}

/**
 * Pre-fetched edge values from product_sizes table.
 * Used to filter climbs by size without joining product_sizes.
 */
export interface SizeEdges {
  edgeLeft: number;
  edgeRight: number;
  edgeBottom: number;
  edgeTop: number;
}

/**
 * Search parameters for the climb search query.
 * Shared between web and backend packages.
 */
export interface ClimbSearchParams {
  // Pagination
  page?: number;
  pageSize?: number;
  // Sorting
  sortBy?: string;
  sortOrder?: string;
  // Filters
  gradeAccuracy?: number;
  minGrade?: number;
  maxGrade?: number;
  minRating?: number;
  minAscents?: number;
  name?: string;
  settername?: string[];
  onlyTallClimbs?: boolean;
  // Hold filters - 'ANY', 'NOT', or specific states like 'STARTING', 'HAND', etc.
  holdsFilter?: Record<string, HoldState | string>;
  // Personal progress filters
  hideAttempted?: boolean;
  hideCompleted?: boolean;
  showOnlyAttempted?: boolean;
  showOnlyCompleted?: boolean;
  onlyDrafts?: boolean;
}

/**
 * Result of a climb search query.
 */
export interface ClimbSearchResult {
  climbs: ClimbRow[];
  hasMore: boolean;
}

/**
 * A single row from the climb search query.
 * Lightweight - no litUpHoldsMap or other derived fields.
 */
export interface ClimbRow {
  uuid: string;
  setter_username: string;
  name: string;
  description: string;
  frames: string;
  angle: number;
  ascensionist_count: number;
  difficulty: string;
  quality_average: string;
  stars: number;
  difficulty_error: string;
  benchmark_difficulty: string | null;
  is_draft: boolean;
  userAscents?: number;
  userAttempts?: number;
}
