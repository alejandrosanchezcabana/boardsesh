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

  const sortBy = searchParams.sortBy || (searchParams.onlyDrafts ? 'creation' : 'ascents');
  const sortOrder = searchParams.sortOrder === 'asc' ? 'asc' : 'desc';

  // For the popular sort, pre-aggregate total ascents across all angles via a joined subquery
  // instead of a correlated subquery that runs per candidate row.
  const popularCountsSubquery = sortBy === 'popular'
    ? db
        .select({
          climbUuid: boardClimbStats.climbUuid,
          totalAscensionistCount: sql<number>`COALESCE(SUM(${boardClimbStats.ascensionistCount}), 0)`.as('total_ascensionist_count'),
        })
        .from(boardClimbStats)
        .where(eq(boardClimbStats.boardType, params.board_name))
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

  const whereConditions = [
    ...filters.getClimbWhereConditions(),
    ...filters.getSizeConditions(),
    ...filters.getClimbStatsConditions(),
  ];

  const selectFields = {
    uuid: boardClimbs.uuid,
    setter_username: boardClimbs.setterUsername,
    name: boardClimbs.name,
    frames: boardClimbs.frames,
    is_draft: boardClimbs.isDraft,
    angle: boardClimbStats.angle,
    ascensionist_count: boardClimbStats.ascensionistCount,
    difficulty_id: sql<number>`ROUND(${boardClimbStats.displayDifficulty}::numeric, 0)`,
    quality_average: sql<number>`ROUND(${boardClimbStats.qualityAverage}::numeric, 2)`,
    difficulty_error: sql<number>`ROUND(${boardClimbStats.difficultyAverage}::numeric - ${boardClimbStats.displayDifficulty}::numeric, 2)`,
    benchmark_difficulty: boardClimbStats.benchmarkDifficulty,
  };

  const orderByClause = sortOrder === 'asc'
    ? sql`${sortColumn} ASC NULLS FIRST`
    : sql`${sortColumn} DESC NULLS LAST`;

  // For the default ascents sort, drive from board_climb_stats to leverage the
  // covering index (board_type, angle, ascensionist_count DESC NULLS LAST).
  // PostgreSQL reads the index in sorted order and stops after 21 qualifying rows,
  // avoiding a full sort of all matching climbs.
  const useStatsDriven = sortBy === 'ascents' && sortOrder === 'desc';

  type SelectResult = {
    uuid: string;
    setter_username: string | null;
    name: string | null;
    frames: string | null;
    is_draft: boolean | null;
    angle: number | null;
    ascensionist_count: string | null;
    difficulty_id: number;
    quality_average: number;
    difficulty_error: number;
    benchmark_difficulty: number | null;
  };

  let results: SelectResult[];

  if (useStatsDriven) {
    // Stats-driven: FROM board_climb_stats INNER JOIN board_climbs
    // The climb filter conditions move to the JOIN predicate so the index scan
    // on board_climb_stats drives the query in sorted order.
    const climbJoinConditions = [
      eq(boardClimbs.uuid, boardClimbStats.climbUuid),
      ...filters.getClimbWhereConditions(),
      ...filters.getSizeConditions(),
    ];

    const statsWhereConditions = [
      eq(boardClimbStats.boardType, params.board_name),
      eq(boardClimbStats.angle, params.angle),
      ...filters.getClimbStatsConditions(),
    ];

    results = await db
      .select(selectFields)
      .from(boardClimbStats)
      .innerJoin(boardClimbs, and(...climbJoinConditions))
      .where(and(...statsWhereConditions))
      .orderBy(sql`${boardClimbStats.ascensionistCount} DESC NULLS LAST`, desc(boardClimbs.uuid))
      .limit(pageSize + 1)
      .offset(page * pageSize);
  } else {
    // Standard path: FROM board_climbs LEFT JOIN board_climb_stats
    const coreQuery = db
      .select(selectFields)
      .from(boardClimbs)
      .leftJoin(boardClimbStats, and(...filters.getClimbStatsJoinConditions()));

    // Only add popular counts join when sorting by popular
    const queryWithJoins = popularCountsSubquery
      ? coreQuery.leftJoin(popularCountsSubquery, eq(popularCountsSubquery.climbUuid, boardClimbs.uuid))
      : coreQuery;

    results = await queryWithJoins
      .where(and(...whereConditions))
      .orderBy(orderByClause, desc(boardClimbs.uuid))
      .limit(pageSize + 1)
      .offset(page * pageSize);
  }

  const hasMore = results.length > pageSize;
  const trimmedResults = hasMore ? results.slice(0, pageSize) : results;

  const climbs: ClimbRow[] = trimmedResults.map((result) => ({
    uuid: result.uuid,
    setter_username: result.setter_username || '',
    name: result.name || '',
    description: '',
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
