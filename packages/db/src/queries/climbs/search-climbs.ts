import { desc, sql, and, eq } from 'drizzle-orm';
import type { DbInstance } from '../../client/neon';
import {
  boardClimbs,
  boardClimbStats,
} from '../../schema/index';
import { createClimbFilters } from './create-climb-filters';
import { getGradeLabel } from './grade-lookup';
import type { BoardRouteParams, ClimbSearchParams, ClimbRow, ClimbSearchResult, SizeEdges } from './types';

type RawSelectResult = {
  uuid: string;
  setter_username: string | null;
  name: string | null;
  frames: string | null;
  is_draft: boolean | null;
  angle: number | null;
  ascensionist_count: string | null;
  difficulty_id: number | null;
  quality_average: number | null;
  difficulty_error: number | null;
  benchmark_difficulty: number | null;
};

function mapResultToClimbRow(result: RawSelectResult, angle: number): ClimbRow {
  return {
    uuid: result.uuid,
    setter_username: result.setter_username || '',
    name: result.name || '',
    frames: result.frames || '',
    angle,
    ascensionist_count: Number(result.ascensionist_count || 0),
    difficulty: getGradeLabel(result.difficulty_id),
    quality_average: result.quality_average?.toString() || '0',
    stars: Math.round((Number(result.quality_average) || 0) * 5),
    difficulty_error: result.difficulty_error?.toString() || '0',
    benchmark_difficulty: result.benchmark_difficulty && result.benchmark_difficulty > 0 ? result.benchmark_difficulty.toString() : null,
    is_draft: result.is_draft ?? false,
  };
}

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
  const isDraftsQuery = !!searchParams.onlyDrafts;

  // For the default hot path (ascents DESC), use a stats-driven query that reads
  // the covering index in sorted order and stops after pageSize+1 qualifying rows.
  // This avoids scanning all 15K+ matching climbs just to sort and take 21.
  //
  // Climbs without stats (0 ascents) sort last in DESC order so they never appear
  // on early pages. When the stats-driven query returns fewer rows than needed,
  // a supplementary query fetches no-stats climbs to fill remaining slots.
  const useStatsDriven = sortBy === 'ascents' && sortOrder === 'desc' && !isDraftsQuery;

  if (useStatsDriven) {
    return statsDrivenSearch(db, params, searchParams, filters, sizeEdges, page, pageSize, userId);
  }

  return standardSearch(db, params, searchParams, filters, sortBy, sortOrder, isDraftsQuery, page, pageSize);
};

/**
 * Stats-driven search: FROM board_climb_stats with covering index.
 * PostgreSQL reads the index in ascensionist_count DESC order and stops early.
 * Supplementary query fetches no-stats climbs when we run out of stats-having climbs.
 */
async function statsDrivenSearch(
  db: DbInstance,
  params: BoardRouteParams,
  searchParams: ClimbSearchParams,
  filters: ReturnType<typeof createClimbFilters>,
  sizeEdges: SizeEdges,
  page: number,
  pageSize: number,
  userId?: string,
): Promise<ClimbSearchResult> {
  const selectFields = {
    uuid: boardClimbs.uuid,
    setter_username: boardClimbs.setterUsername,
    name: boardClimbs.name,
    frames: boardClimbs.frames,
    is_draft: boardClimbs.isDraft,
    angle: boardClimbStats.angle,
    ascensionist_count: boardClimbStats.ascensionistCount,
    difficulty_id: sql<number | null>`ROUND(${boardClimbStats.displayDifficulty}::numeric, 0)`,
    quality_average: sql<number | null>`ROUND(${boardClimbStats.qualityAverage}::numeric, 2)`,
    difficulty_error: sql<number | null>`ROUND(${boardClimbStats.difficultyAverage}::numeric - ${boardClimbStats.displayDifficulty}::numeric, 2)`,
    benchmark_difficulty: boardClimbStats.benchmarkDifficulty,
  };

  // Move climb filters to the JOIN predicate so the covering index scan on
  // board_climb_stats drives the query in sorted order.
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

  const results: RawSelectResult[] = await db
    .select(selectFields)
    .from(boardClimbStats)
    .innerJoin(boardClimbs, and(...climbJoinConditions))
    .where(and(...statsWhereConditions))
    .orderBy(sql`${boardClimbStats.ascensionistCount} DESC NULLS LAST`, desc(boardClimbs.uuid))
    .limit(pageSize + 1)
    .offset(page * pageSize) as unknown as RawSelectResult[];

  // If the stats-driven query filled the page, no-stats climbs aren't needed yet
  if (results.length > pageSize) {
    const climbs = results.slice(0, pageSize).map((r) => mapResultToClimbRow(r, params.angle));
    return { climbs, hasMore: true };
  }

  // Stats-driven query didn't fill the page — supplement with no-stats climbs.
  // These have 0 ascents and sort after all stats-having climbs.
  const statsCount = page * pageSize + results.length;
  const remaining = pageSize + 1 - results.length;
  const noStatsOffset = Math.max(0, page * pageSize - statsCount);

  const noStatsResults = remaining > 0 ? await db
    .select({
      uuid: boardClimbs.uuid,
      setter_username: boardClimbs.setterUsername,
      name: boardClimbs.name,
      frames: boardClimbs.frames,
      is_draft: boardClimbs.isDraft,
      angle: sql<null>`NULL`.as('angle'),
      ascensionist_count: sql<null>`NULL`.as('ascensionist_count'),
      difficulty_id: sql<null>`NULL`.as('difficulty_id'),
      quality_average: sql<null>`NULL`.as('quality_average'),
      difficulty_error: sql<null>`NULL`.as('difficulty_error'),
      benchmark_difficulty: sql<null>`NULL`.as('benchmark_difficulty'),
    })
    .from(boardClimbs)
    .where(and(
      ...filters.getClimbWhereConditions(),
      ...filters.getSizeConditions(),
      sql`NOT EXISTS (
        SELECT 1 FROM ${boardClimbStats}
        WHERE ${boardClimbStats.boardType} = ${params.board_name}
        AND ${boardClimbStats.climbUuid} = ${boardClimbs.uuid}
        AND ${boardClimbStats.angle} = ${params.angle}
      )`,
    ))
    .orderBy(desc(boardClimbs.uuid))
    .limit(remaining)
    .offset(noStatsOffset) as unknown as RawSelectResult[] : [];

  const combined: RawSelectResult[] = [...results, ...noStatsResults];
  const hasMore = combined.length > pageSize;
  const trimmed = hasMore ? combined.slice(0, pageSize) : combined;

  // description is intentionally excluded — it's unbounded text that inflates I/O.
  // Features needing it should fetch separately via the climb detail query.
  const climbs = trimmed.map((r) => mapResultToClimbRow(r, params.angle));
  return { climbs, hasMore };
}

/**
 * Standard search: FROM board_climbs LEFT JOIN board_climb_stats.
 * Used for non-default sorts (difficulty, name, quality, creation, popular)
 * and for draft queries.
 */
async function standardSearch(
  db: DbInstance,
  params: BoardRouteParams,
  searchParams: ClimbSearchParams,
  filters: ReturnType<typeof createClimbFilters>,
  sortBy: string,
  sortOrder: string,
  isDraftsQuery: boolean,
  page: number,
  pageSize: number,
): Promise<ClimbSearchResult> {
  // For the popular sort, pre-aggregate total ascents across all angles via a joined subquery
  // instead of a correlated subquery that runs per candidate row.
  // Scoped with an EXISTS to only aggregate stats for climbs matching the search filters.
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

  const sortColumn = allowedSortColumns[sortBy] || sql`${boardClimbs.createdAt}`;

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
    quality_average: sql<number | null>`ROUND(${boardClimbStats.qualityAverage}::numeric, 2)`,
    difficulty_error: sql<number | null>`ROUND(${boardClimbStats.difficultyAverage}::numeric - ${boardClimbStats.displayDifficulty}::numeric, 2)`,
    benchmark_difficulty: boardClimbStats.benchmarkDifficulty,
  };

  const orderByClause = sortOrder === 'asc'
    ? sql`${sortColumn} ASC NULLS FIRST`
    : sql`${sortColumn} DESC NULLS LAST`;

  // LEFT JOIN preserves climbs without stats (they get NULL stats columns).
  const coreQuery = db
    .select(selectFields)
    .from(boardClimbs)
    .leftJoin(boardClimbStats, and(...filters.getClimbStatsJoinConditions()));

  const queryWithJoins = popularCountsSubquery
    ? coreQuery.leftJoin(popularCountsSubquery, eq(popularCountsSubquery.climbUuid, boardClimbs.uuid))
    : coreQuery;

  const results: RawSelectResult[] = await queryWithJoins
    .where(and(...whereConditions))
    .orderBy(orderByClause, desc(boardClimbs.uuid))
    .limit(pageSize + 1)
    .offset(page * pageSize) as unknown as RawSelectResult[];

  const hasMore = results.length > pageSize;
  const trimmed = hasMore ? results.slice(0, pageSize) : results;

  // description is intentionally excluded — it's unbounded text that inflates I/O.
  // Features needing it should fetch separately via the climb detail query.
  const climbs = trimmed.map((r) => mapResultToClimbRow(r, params.angle));
  return { climbs, hasMore };
}
