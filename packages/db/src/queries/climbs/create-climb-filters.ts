import { eq, gte, sql, like, notLike, inArray, SQL } from 'drizzle-orm';
import {
  boardClimbs,
  boardClimbStats,
  boardseshTicks,
  boardProductSizes,
  boardClimbHolds,
} from '../../schema/index';
import type { BoardRouteParams, ClimbSearchParams, SizeEdges } from './types';

// Kilter Homewall constants for tall-climb filtering
const KILTER_HOMEWALL_LAYOUT_ID = 8;
const KILTER_HOMEWALL_PRODUCT_ID = 7;

/**
 * Creates a shared filtering object for climb search and heatmap queries.
 * Uses unified tables (board_climbs, board_climb_stats, etc.) with board_type filtering.
 *
 * @param params Board route parameters (board_name, layout_id, etc.)
 * @param searchParams Search/filter parameters
 * @param sizeEdges Pre-fetched edge values from product_sizes
 * @param userId Optional user ID for personal progress filters
 */
export const createClimbFilters = (
  params: BoardRouteParams,
  searchParams: ClimbSearchParams,
  sizeEdges: SizeEdges,
  userId?: string,
) => {
  // Process hold filters
  const holdsToFilter = Object.entries(searchParams.holdsFilter || {}).map(([key, stateOrValue]) => {
    const holdId = key.replace('hold_', '');
    // Handle both object form { state: 'STARTING' } and string form 'STARTING'
    const state = typeof stateOrValue === 'object' && stateOrValue !== null
      ? (stateOrValue as { state: string }).state
      : stateOrValue;
    return [holdId, state] as const;
  });

  const anyHolds = holdsToFilter.filter(([, value]) => value === 'ANY').map(([key]) => Number(key));
  const notHolds = holdsToFilter.filter(([, value]) => value === 'NOT').map(([key]) => Number(key));

  // Hold state filters - hold must be present with specific state (STARTING, HAND, FOOT, FINISH)
  const holdStateFilters = holdsToFilter
    .filter(([, value]) => ['STARTING', 'HAND', 'FOOT', 'FINISH'].includes(value as string))
    .map(([key, state]) => ({ holdId: Number(key), state: state as string }));

  // Base conditions for filtering climbs
  const baseConditions: SQL[] = [
    eq(boardClimbs.boardType, params.board_name),
    eq(boardClimbs.layoutId, params.layout_id),
    eq(boardClimbs.isListed, true),
    eq(boardClimbs.isDraft, false),
    eq(boardClimbs.framesCount, 1),
  ];

  // Size-specific conditions using pre-fetched static edge values
  // MoonBoard climbs have NULL edge values (single fixed size), so skip edge filtering
  const sizeConditions: SQL[] = params.board_name === 'moonboard' ? [] : [
    sql`${boardClimbs.edgeLeft} > ${sizeEdges.edgeLeft}`,
    sql`${boardClimbs.edgeRight} < ${sizeEdges.edgeRight}`,
    sql`${boardClimbs.edgeBottom} > ${sizeEdges.edgeBottom}`,
    sql`${boardClimbs.edgeTop} < ${sizeEdges.edgeTop}`,
  ];

  // Conditions for climb stats
  const climbStatsConditions: SQL[] = [];

  if (searchParams.minAscents) {
    climbStatsConditions.push(gte(boardClimbStats.ascensionistCount, searchParams.minAscents));
  }

  if (searchParams.minGrade && searchParams.maxGrade) {
    climbStatsConditions.push(
      sql`ROUND(${boardClimbStats.displayDifficulty}::numeric, 0) BETWEEN ${searchParams.minGrade} AND ${searchParams.maxGrade}`,
    );
  } else if (searchParams.minGrade) {
    climbStatsConditions.push(
      sql`ROUND(${boardClimbStats.displayDifficulty}::numeric, 0) >= ${searchParams.minGrade}`,
    );
  } else if (searchParams.maxGrade) {
    climbStatsConditions.push(
      sql`ROUND(${boardClimbStats.displayDifficulty}::numeric, 0) <= ${searchParams.maxGrade}`,
    );
  }

  if (searchParams.minRating) {
    climbStatsConditions.push(sql`${boardClimbStats.qualityAverage} >= ${searchParams.minRating}`);
  }

  if (searchParams.gradeAccuracy) {
    climbStatsConditions.push(
      sql`ABS(ROUND(${boardClimbStats.displayDifficulty}::numeric, 0) - ${boardClimbStats.difficultyAverage}::numeric) <= ${searchParams.gradeAccuracy}`,
    );
  }

  // Name search condition
  const nameCondition: SQL[] = searchParams.name ? [sql`${boardClimbs.name} ILIKE ${`%${searchParams.name}%`}`] : [];

  // Setter name filter condition
  const setterNameCondition: SQL[] = searchParams.settername && searchParams.settername.length > 0
    ? [inArray(boardClimbs.setterUsername, searchParams.settername)]
    : [];

  // Hold filter conditions
  const holdConditions: SQL[] = [
    ...anyHolds.map((holdId) => like(boardClimbs.frames, `%${holdId}r%`)),
    ...notHolds.map((holdId) => notLike(boardClimbs.frames, `%${holdId}r%`)),
  ];

  // State-specific hold conditions - use board_climb_holds table
  const holdStateConditions: SQL[] = holdStateFilters.map(({ holdId, state }) =>
    sql`EXISTS (
      SELECT 1 FROM ${boardClimbHolds} ch
      WHERE ch.board_type = ${params.board_name}
      AND ch.climb_uuid = ${boardClimbs.uuid}
      AND ch.hold_id = ${holdId}
      AND ch.hold_state = ${state}
    )`
  );

  // Tall climbs filter condition
  const tallClimbsConditions: SQL[] = [];

  if (searchParams.onlyTallClimbs && params.board_name === 'kilter' && params.layout_id === KILTER_HOMEWALL_LAYOUT_ID) {
    tallClimbsConditions.push(
      sql`${boardClimbs.edgeBottom} < (
        SELECT MAX(ps.edge_bottom)
        FROM ${boardProductSizes} ps
        WHERE ps.board_type = ${params.board_name}
        AND ps.product_id = ${KILTER_HOMEWALL_PRODUCT_ID}
        AND ps.id != ${params.size_id}
      )`
    );
  }

  // Personal progress filter conditions
  const personalProgressConditions: SQL[] = [];
  if (userId) {
    if (searchParams.hideAttempted) {
      personalProgressConditions.push(
        sql`NOT EXISTS (
          SELECT 1 FROM ${boardseshTicks}
          WHERE ${boardseshTicks.climbUuid} = ${boardClimbs.uuid}
          AND ${boardseshTicks.userId} = ${userId}
          AND ${boardseshTicks.boardType} = ${params.board_name}
          AND ${boardseshTicks.angle} = ${params.angle}
          AND ${boardseshTicks.status} = 'attempt'
        )`
      );
    }

    if (searchParams.hideCompleted) {
      personalProgressConditions.push(
        sql`NOT EXISTS (
          SELECT 1 FROM ${boardseshTicks}
          WHERE ${boardseshTicks.climbUuid} = ${boardClimbs.uuid}
          AND ${boardseshTicks.userId} = ${userId}
          AND ${boardseshTicks.boardType} = ${params.board_name}
          AND ${boardseshTicks.angle} = ${params.angle}
          AND ${boardseshTicks.status} IN ('flash', 'send')
        )`
      );
    }

    if (searchParams.showOnlyAttempted) {
      personalProgressConditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${boardseshTicks}
          WHERE ${boardseshTicks.climbUuid} = ${boardClimbs.uuid}
          AND ${boardseshTicks.userId} = ${userId}
          AND ${boardseshTicks.boardType} = ${params.board_name}
          AND ${boardseshTicks.angle} = ${params.angle}
          AND ${boardseshTicks.status} = 'attempt'
        )`
      );
    }

    if (searchParams.showOnlyCompleted) {
      personalProgressConditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${boardseshTicks}
          WHERE ${boardseshTicks.climbUuid} = ${boardClimbs.uuid}
          AND ${boardseshTicks.userId} = ${userId}
          AND ${boardseshTicks.boardType} = ${params.board_name}
          AND ${boardseshTicks.angle} = ${params.angle}
          AND ${boardseshTicks.status} IN ('flash', 'send')
        )`
      );
    }
  }

  return {
    getClimbWhereConditions: () => [
      ...baseConditions,
      ...nameCondition,
      ...setterNameCondition,
      ...holdConditions,
      ...holdStateConditions,
      ...tallClimbsConditions,
      ...personalProgressConditions,
    ],
    getSizeConditions: () => sizeConditions,
    getClimbStatsConditions: () => climbStatsConditions,
    getClimbStatsJoinConditions: () => [
      eq(boardClimbStats.climbUuid, boardClimbs.uuid),
      eq(boardClimbStats.boardType, params.board_name),
      eq(boardClimbStats.angle, params.angle),
    ],
  };
};
