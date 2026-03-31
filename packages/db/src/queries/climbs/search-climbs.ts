import { desc, sql, and, eq } from 'drizzle-orm';
import type { DbInstance } from '../../client/neon';
import {
  boardClimbs,
  boardClimbStats,
} from '../../schema/index';
import { createClimbFilters } from './create-climb-filters';
import { getGradeLabel } from './grade-lookup';
import type { BoardRouteParams, ClimbSearchParams, ClimbRow, ClimbSearchResult, SizeEdges } from './types';

/**
 * Search for climbs with various filters.
 * Shared between the GraphQL backend resolver and Next.js SSR.
 *
 * @param db Drizzle database instance
 * @param params Board route parameters
 * @param searchParams Search/filter parameters
 * @param sizeEdges Pre-fetched edge values for the board size
 * @param userId Optional user ID for personal progress filters
 */
export const searchClimbs = async (
  db: DbInstance,
  params: BoardRouteParams,
  searchParams: ClimbSearchParams,
  sizeEdges: SizeEdges,
  userId?: string,
): Promise<ClimbSearchResult> => {
  const page = searchParams.page ?? 0;
  const pageSize = searchParams.pageSize ?? 20;

  const filters = createClimbFilters(params, searchParams, sizeEdges, userId);

  // Drafts never have stats, so force creation sort (stats-based sorts would be meaningless)
  const sortBy = searchParams.onlyDrafts
    ? 'creation'
    : (searchParams.sortBy || 'ascents');
  const sortOrder = searchParams.sortOrder === 'asc' ? 'asc' : 'desc';

  // For the popular sort, pre-aggregate total ascents across all angles via a joined subquery
  // instead of a correlated subquery that runs per candidate row.
  // Scoped with an EXISTS to only aggregate stats for climbs matching the search filters,
  // avoiding a full scan of board_climb_stats for the entire board_type.
  const popularCountsSubquery = sortBy === 'popular'
    ? db
        .select({
          climbUuid: boardClimbStats.climbUuid,
          totalAscensionistCount: sql<number>`COALESCE(SUM(${boardClimbStats.ascensionistCount}), 0)`.as('total_ascensionist_count'),
        })
        .from(boardClimbStats)
        .where(and(
          eq(boardClimbStats.boardType, params.board_name),
          sql`EXISTS (
            SELECT 1 FROM ${boardClimbs}
            WHERE ${boardClimbs.uuid} = ${boardClimbStats.climbUuid}
            AND ${boardClimbs.boardType} = ${params.board_name}
            AND ${boardClimbs.layoutId} = ${params.layout_id}
            AND ${boardClimbs.isListed} = true
            AND ${boardClimbs.isDraft} = false
            AND ${boardClimbs.framesCount} = 1
          )`,
        ))
        .groupBy(boardClimbStats.climbUuid)
        .as('popular_counts')
    : null;

  // Define sort columns
  const allowedSortColumns: Record<string, ReturnType<typeof sql>> = {
    ascents: sql`${boardClimbStats.ascensionistCount}`,
    difficulty: sql`ROUND(${boardClimbStats.displayDifficulty}::numeric, 0)`,
    name: sql`${boardClimbs.name}`,
    quality: sql`${boardClimbStats.qualityAverage}`,
    creation: sql`${boardClimbs.createdAt}`,
    ...(popularCountsSubquery
      ? { popular: sql`${popularCountsSubquery.totalAscensionistCount}` }
      : {}),
  };

  const sortColumn = allowedSortColumns[sortBy] || sql`${boardClimbStats.ascensionistCount}`;

  const isDraftsQuery = !!searchParams.onlyDrafts;

  const whereConditions = [
    ...filters.getClimbWhereConditions(),
    ...filters.getSizeConditions(),
    // Draft climbs never have board_climb_stats rows, so stats-based filters
    // (grade range, min ascents, quality, accuracy) would reject every draft.
    ...(isDraftsQuery ? [] : filters.getClimbStatsConditions()),
  ];

  const selectFields = {
    uuid: boardClimbs.uuid,
    setter_username: boardClimbs.setterUsername,
    name: boardClimbs.name,
    frames: boardClimbs.frames,
    is_draft: boardClimbs.isDraft,
    angle: boardClimbStats.angle,
    ascensionist_count: boardClimbStats.ascensionistCount,
    difficulty_id: sql<number | null>`ROUND(${boardClimbStats.displayDifficulty}::numeric, 0)`,
    quality_average: sql<number>`ROUND(${boardClimbStats.qualityAverage}::numeric, 2)`,
    difficulty_error: sql<number>`ROUND(${boardClimbStats.difficultyAverage}::numeric - ${boardClimbStats.displayDifficulty}::numeric, 2)`,
    benchmark_difficulty: boardClimbStats.benchmarkDifficulty,
  };

  const orderByClause = sortOrder === 'asc'
    ? sql`${sortColumn} ASC NULLS FIRST`
    : sql`${sortColumn} DESC NULLS LAST`;

  // LEFT JOIN board_climb_stats for grade/sort data.
  // Draft climbs never have stats rows so the JOIN returns NULLs — that's fine,
  // stats conditions are already skipped above and sort is forced to creation.
  const coreQuery = db
    .select(selectFields)
    .from(boardClimbs)
    .leftJoin(boardClimbStats, and(...filters.getClimbStatsJoinConditions()));

  // Only add popular counts join when sorting by popular
  const queryWithJoins = popularCountsSubquery
    ? coreQuery.leftJoin(popularCountsSubquery, eq(popularCountsSubquery.climbUuid, boardClimbs.uuid))
    : coreQuery;

  const results = await queryWithJoins
    .where(and(...whereConditions))
    .orderBy(orderByClause, desc(boardClimbs.uuid))
    .limit(pageSize + 1)
    .offset(page * pageSize);

  const hasMore = results.length > pageSize;
  const trimmedResults = hasMore ? results.slice(0, pageSize) : results;

  // description is intentionally excluded from search results — it's unbounded text
  // that inflates I/O and transfer. Any feature needing it should fetch it separately
  // via the single-climb detail query (getClimbByUuid).
  const climbs: ClimbRow[] = trimmedResults.map((result) => ({
    uuid: result.uuid,
    setter_username: result.setter_username || '',
    name: result.name || '',
    frames: result.frames || '',
    angle: Number(params.angle),
    ascensionist_count: Number(result.ascensionist_count || 0),
    difficulty: getGradeLabel(result.difficulty_id),
    quality_average: result.quality_average?.toString() || '0',
    stars: Math.round((Number(result.quality_average) || 0) * 5),
    difficulty_error: result.difficulty_error?.toString() || '0',
    benchmark_difficulty: result.benchmark_difficulty && result.benchmark_difficulty > 0 ? result.benchmark_difficulty.toString() : null,
    is_draft: result.is_draft ?? false,
  }));

  return { climbs, hasMore };
};
