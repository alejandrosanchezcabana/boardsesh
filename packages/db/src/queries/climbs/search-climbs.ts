import { desc, sql, and, eq } from 'drizzle-orm';
import type { DbInstance } from '../../client/neon';
import {
  boardClimbs,
  boardClimbStats,
  boardDifficultyGrades,
  boardseshTicks,
} from '../../schema/index';
import { createClimbFilters } from './create-climb-filters';
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

  // Define sort columns
  const allowedSortColumns: Record<string, ReturnType<typeof sql>> = {
    ascents: sql`${boardClimbStats.ascensionistCount}`,
    difficulty: sql`ROUND(${boardClimbStats.displayDifficulty}::numeric, 0)`,
    name: sql`${boardClimbs.name}`,
    quality: sql`${boardClimbStats.qualityAverage}`,
    popular: sql`(
      SELECT COALESCE(SUM(cs.ascensionist_count), 0)
      FROM ${boardClimbStats} cs
      WHERE cs.board_type = ${params.board_name} AND cs.climb_uuid = ${boardClimbs.uuid}
    )`,
  };

  const sortColumn = allowedSortColumns[searchParams.sortBy || 'ascents'] || sql`${boardClimbStats.ascensionistCount}`;

  const whereConditions = [
    ...filters.getClimbWhereConditions(),
    ...filters.getSizeConditions(),
    ...filters.getClimbStatsConditions(),
  ];

  const baseSelectFields = {
    uuid: boardClimbs.uuid,
    setter_username: boardClimbs.setterUsername,
    name: boardClimbs.name,
    description: boardClimbs.description,
    frames: boardClimbs.frames,
    angle: boardClimbStats.angle,
    ascensionist_count: boardClimbStats.ascensionistCount,
    difficulty: boardDifficultyGrades.boulderName,
    quality_average: sql<number>`ROUND(${boardClimbStats.qualityAverage}::numeric, 2)`,
    difficulty_error: sql<number>`ROUND(${boardClimbStats.difficultyAverage}::numeric - ${boardClimbStats.displayDifficulty}::numeric, 2)`,
    benchmark_difficulty: boardClimbStats.benchmarkDifficulty,
  };

  const userTicksSubquery = userId
    ? db
        .select({
          climbUuid: boardseshTicks.climbUuid,
          userAscents: sql<number>`COUNT(*) FILTER (WHERE ${boardseshTicks.status} IN ('flash', 'send'))`.as('user_ascents'),
          userAttempts: sql<number>`COUNT(*) FILTER (WHERE ${boardseshTicks.status} = 'attempt')`.as('user_attempts'),
        })
        .from(boardseshTicks)
        .where(and(
          eq(boardseshTicks.userId, userId),
          eq(boardseshTicks.boardType, params.board_name),
          eq(boardseshTicks.angle, params.angle),
        ))
        .groupBy(boardseshTicks.climbUuid)
        .as('user_ticks')
    : null;

  const selectFields = userId && userTicksSubquery
    ? {
        ...baseSelectFields,
        userAscents: sql<number>`COALESCE(${userTicksSubquery.userAscents}, 0)`,
        userAttempts: sql<number>`COALESCE(${userTicksSubquery.userAttempts}, 0)`,
      }
    : baseSelectFields;

  const sortOrder = searchParams.sortOrder === 'asc' ? 'asc' : 'desc';

  const difficultyGradesJoinCondition = and(
    eq(boardDifficultyGrades.difficulty, sql`ROUND(${boardClimbStats.displayDifficulty}::numeric)`),
    eq(boardDifficultyGrades.boardType, params.board_name),
  );

  const orderByClause = sortOrder === 'asc'
    ? sql`${sortColumn} ASC NULLS FIRST`
    : sql`${sortColumn} DESC NULLS LAST`;

  // When showDrafts is active, surface draft climbs first
  const draftsFirstClause = searchParams.showDrafts
    ? sql`CASE WHEN ${boardClimbs.isDraft} = true THEN 0 ELSE 1 END`
    : undefined;

  const coreQuery = db
    .select(selectFields)
    .from(boardClimbs)
    .leftJoin(boardClimbStats, and(...filters.getClimbStatsJoinConditions()))
    .leftJoin(boardDifficultyGrades, difficultyGradesJoinCondition);

  const baseQuery = (userId && userTicksSubquery
    ? coreQuery.leftJoin(userTicksSubquery, eq(userTicksSubquery.climbUuid, boardClimbs.uuid))
    : coreQuery
  )
    .where(and(...whereConditions))
    .orderBy(...(draftsFirstClause ? [draftsFirstClause, orderByClause, desc(boardClimbs.uuid)] : [orderByClause, desc(boardClimbs.uuid)]))
    .limit(pageSize + 1)
    .offset(page * pageSize);

  const results = await baseQuery;

  const hasMore = results.length > pageSize;
  const trimmedResults = hasMore ? results.slice(0, pageSize) : results;

  const climbs: ClimbRow[] = trimmedResults.map((result) => ({
    uuid: result.uuid,
    setter_username: result.setter_username || '',
    name: result.name || '',
    description: result.description || '',
    frames: result.frames || '',
    angle: Number(params.angle),
    ascensionist_count: Number(result.ascensionist_count || 0),
    difficulty: result.difficulty || '',
    quality_average: result.quality_average?.toString() || '0',
    stars: Math.round((Number(result.quality_average) || 0) * 5),
    difficulty_error: result.difficulty_error?.toString() || '0',
    benchmark_difficulty: result.benchmark_difficulty && result.benchmark_difficulty > 0 ? result.benchmark_difficulty.toString() : null,
    userAscents: userId ? Number((result as Record<string, unknown>)?.userAscents || 0) : undefined,
    userAttempts: userId ? Number((result as Record<string, unknown>)?.userAttempts || 0) : undefined,
  }));

  return { climbs, hasMore };
};
