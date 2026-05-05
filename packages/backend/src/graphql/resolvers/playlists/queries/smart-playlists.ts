import { eq, and, desc, sql, inArray, notInArray, max, type SQL } from 'drizzle-orm';
import { type ConnectionContext, type Climb, type BoardName } from '@boardsesh/shared-schema';
import { db } from '../../../../db/client';
import * as dbSchema from '@boardsesh/db/schema';
import { getGradeLabel } from '@boardsesh/db/queries';
import { requireAuthenticated, validateInput } from '../../shared/helpers';
import { GetSmartPlaylistInputSchema } from '../../../../validation/schemas';
import { UNIFIED_TABLES } from '../../../../db/queries/util/table-select';

type SmartPlaylistType = 'FIVE_STARS' | 'MOST_REPEATED' | 'PROJECTS';

type SmartPlaylistInput = {
  type: SmartPlaylistType;
  userId: string;
  boardName?: string;
  layoutId?: number;
  sizeId?: number;
  setIds?: string;
  angle?: number;
  page?: number;
  pageSize?: number;
};

type SmartClimbRef = {
  climbUuid: string;
  boardType: string;
};

/**
 * Build the WHERE conditions shared by every smart-playlist query path:
 * `userId = ?` plus, when scoped, `boardType = ?`.
 */
function smartBaseConditions(userId: string, boardName: string | undefined): SQL[] {
  const conditions: SQL[] = [eq(dbSchema.boardseshTicks.userId, userId)];
  if (boardName) {
    conditions.push(eq(dbSchema.boardseshTicks.boardType, boardName));
  }
  return conditions;
}

/**
 * Subquery of climbUuids the user has flashed or sent. Scoped by boardType when
 * a board filter is active so that, e.g., a sent climb on Kilter doesn't
 * accidentally exclude an unrelated UUID-collision climb on Tension.
 */
function sentClimbsSubquery(userId: string, boardName: string | undefined) {
  const conditions: SQL[] = [
    eq(dbSchema.boardseshTicks.userId, userId),
    inArray(dbSchema.boardseshTicks.status, ['flash', 'send']),
  ];
  if (boardName) {
    conditions.push(eq(dbSchema.boardseshTicks.boardType, boardName));
  }
  return db
    .select({ climbUuid: dbSchema.boardseshTicks.climbUuid })
    .from(dbSchema.boardseshTicks)
    .where(and(...conditions));
}

/**
 * Page of (climbUuid, boardType) pairs for the smart playlist, ordered by the
 * type's natural ranking (latest 5-star, most attempts, etc.). Pagination is
 * pushed into the database — we never materialize the full list in memory.
 */
async function selectSmartClimbRefs(
  type: SmartPlaylistType,
  userId: string,
  boardName: string | undefined,
  page: number,
  pageSize: number,
): Promise<SmartClimbRef[]> {
  const conditions = smartBaseConditions(userId, boardName);
  const offset = page * pageSize;

  if (type === 'FIVE_STARS') {
    const rows = await db
      .select({
        climbUuid: dbSchema.boardseshTicks.climbUuid,
        boardType: dbSchema.boardseshTicks.boardType,
        latestClimbedAt: max(dbSchema.boardseshTicks.climbedAt),
      })
      .from(dbSchema.boardseshTicks)
      .where(and(...conditions, eq(dbSchema.boardseshTicks.quality, 5)))
      .groupBy(dbSchema.boardseshTicks.climbUuid, dbSchema.boardseshTicks.boardType)
      .orderBy(desc(max(dbSchema.boardseshTicks.climbedAt)))
      .limit(pageSize)
      .offset(offset);
    return rows.map((row) => ({ climbUuid: row.climbUuid, boardType: row.boardType }));
  }

  if (type === 'MOST_REPEATED') {
    const rows = await db
      .select({
        climbUuid: dbSchema.boardseshTicks.climbUuid,
        boardType: dbSchema.boardseshTicks.boardType,
        total: sql<number>`SUM(${dbSchema.boardseshTicks.attemptCount})::int`,
      })
      .from(dbSchema.boardseshTicks)
      .where(and(...conditions))
      .groupBy(dbSchema.boardseshTicks.climbUuid, dbSchema.boardseshTicks.boardType)
      .having(sql`SUM(${dbSchema.boardseshTicks.attemptCount}) > 1`)
      .orderBy(desc(sql`SUM(${dbSchema.boardseshTicks.attemptCount})`))
      .limit(pageSize)
      .offset(offset);
    return rows.map((row) => ({ climbUuid: row.climbUuid, boardType: row.boardType }));
  }

  // PROJECTS — climbs the user has logged but never sent on this board.
  // notInArray(sentSubquery) is the necessary check: any climb the user has
  // flashed or sent gets excluded entirely. We don't add `status = 'attempt'`
  // because a climb that survives notInArray has no flash/send rows by
  // definition, so the additional row filter is redundant.
  const rows = await db
    .select({
      climbUuid: dbSchema.boardseshTicks.climbUuid,
      boardType: dbSchema.boardseshTicks.boardType,
      total: sql<number>`SUM(${dbSchema.boardseshTicks.attemptCount})::int`,
    })
    .from(dbSchema.boardseshTicks)
    .where(and(...conditions, notInArray(dbSchema.boardseshTicks.climbUuid, sentClimbsSubquery(userId, boardName))))
    .groupBy(dbSchema.boardseshTicks.climbUuid, dbSchema.boardseshTicks.boardType)
    .orderBy(desc(sql`SUM(${dbSchema.boardseshTicks.attemptCount})`))
    .limit(pageSize)
    .offset(offset);
  return rows.map((row) => ({ climbUuid: row.climbUuid, boardType: row.boardType }));
}

/**
 * Total number of climbs the smart playlist would contain. Computed against
 * the same conditions as selectSmartClimbRefs so that paging is consistent.
 */
async function countSmartClimbRefs(
  type: SmartPlaylistType,
  userId: string,
  boardName: string | undefined,
): Promise<number> {
  const conditions = smartBaseConditions(userId, boardName);

  if (type === 'FIVE_STARS') {
    const [row] = await db
      .select({
        count: sql<number>`COUNT(DISTINCT (${dbSchema.boardseshTicks.boardType}, ${dbSchema.boardseshTicks.climbUuid}))::int`,
      })
      .from(dbSchema.boardseshTicks)
      .where(and(...conditions, eq(dbSchema.boardseshTicks.quality, 5)));
    return row?.count ?? 0;
  }

  if (type === 'MOST_REPEATED') {
    const subquery = db
      .select({
        climbUuid: dbSchema.boardseshTicks.climbUuid,
        boardType: dbSchema.boardseshTicks.boardType,
      })
      .from(dbSchema.boardseshTicks)
      .where(and(...conditions))
      .groupBy(dbSchema.boardseshTicks.climbUuid, dbSchema.boardseshTicks.boardType)
      .having(sql`SUM(${dbSchema.boardseshTicks.attemptCount}) > 1`)
      .as('repeated');
    const [row] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(subquery);
    return row?.count ?? 0;
  }

  const [row] = await db
    .select({
      count: sql<number>`COUNT(DISTINCT (${dbSchema.boardseshTicks.boardType}, ${dbSchema.boardseshTicks.climbUuid}))::int`,
    })
    .from(dbSchema.boardseshTicks)
    .where(and(...conditions, notInArray(dbSchema.boardseshTicks.climbUuid, sentClimbsSubquery(userId, boardName))));
  return row?.count ?? 0;
}

/**
 * Hydrate a page of (climbUuid, boardType) pairs into full Climb objects, joining
 * climbs and climbStats. Mirrors the all-boards mode of the playlistClimbs resolver.
 *
 * TODO: deduplicate with `fetchAllBoardsClimbs` in `playlist-climbs.ts` — both
 * paths build the same SELECT + LEFT JOIN angle subselect against UNIFIED_TABLES
 * and emit the same Climb shape. A schema change to climbStats currently has to
 * be made in both files in lockstep.
 */
async function hydrateClimbs(refs: SmartClimbRef[]): Promise<Climb[]> {
  if (refs.length === 0) return [];

  const tables = UNIFIED_TABLES;
  const uuids = refs.map((r) => r.climbUuid);

  const rows = await db
    .select({
      climbUuid: tables.climbs.uuid,
      layoutId: tables.climbs.layoutId,
      boardType: tables.climbs.boardType,
      setter_username: tables.climbs.setterUsername,
      name: tables.climbs.name,
      description: tables.climbs.description,
      frames: tables.climbs.frames,
      statsAngle: tables.climbStats.angle,
      ascensionist_count: tables.climbStats.ascensionistCount,
      difficulty_id: sql<number | null>`ROUND(${tables.climbStats.displayDifficulty}::numeric, 0)`,
      quality_average: sql<number>`ROUND(${tables.climbStats.qualityAverage}::numeric, 2)`,
      difficulty_error: sql<number>`ROUND(${tables.climbStats.difficultyAverage}::numeric - ${tables.climbStats.displayDifficulty}::numeric, 2)`,
      benchmark_difficulty: tables.climbStats.benchmarkDifficulty,
    })
    .from(tables.climbs)
    .leftJoin(
      tables.climbStats,
      and(
        eq(tables.climbStats.boardType, tables.climbs.boardType),
        eq(tables.climbStats.climbUuid, tables.climbs.uuid),
        eq(
          tables.climbStats.angle,
          sql`(
            SELECT s.angle FROM ${tables.climbStats} s
            WHERE s.board_type = ${tables.climbs.boardType}
              AND s.climb_uuid = ${tables.climbs.uuid}
            ORDER BY s.ascensionist_count DESC NULLS LAST
            LIMIT 1
          )`,
        ),
      ),
    )
    .where(inArray(tables.climbs.uuid, uuids));

  // Build a map for quick lookup, keyed by (boardType, uuid) since uuids can collide across boards.
  const climbMap = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    climbMap.set(`${row.boardType}:${row.climbUuid}`, row);
  }

  const DEFAULT_ANGLE = 40;
  const climbs: Climb[] = [];

  for (const ref of refs) {
    const row = climbMap.get(`${ref.boardType}:${ref.climbUuid}`);
    if (!row) continue;
    const bt = (row.boardType || ref.boardType) as BoardName;
    climbs.push({
      uuid: row.climbUuid,
      layoutId: row.layoutId,
      setter_username: row.setter_username || '',
      name: row.name || '',
      description: row.description || '',
      frames: row.frames || '',
      angle: row.statsAngle ?? DEFAULT_ANGLE,
      ascensionist_count: Number(row.ascensionist_count || 0),
      difficulty: getGradeLabel(row.difficulty_id),
      quality_average: row.quality_average?.toString() || '0',
      stars: Math.round((Number(row.quality_average) || 0) * 5),
      difficulty_error: row.difficulty_error?.toString() || '0',
      benchmark_difficulty:
        row.benchmark_difficulty && row.benchmark_difficulty > 0 ? row.benchmark_difficulty.toString() : null,
      boardType: bt,
    });
  }

  return climbs;
}

/**
 * Public smart playlist query — anyone with the URL can view a user's
 * computed playlist. Uses the user's logbook (boardseshTicks).
 */
export const smartPlaylist = async (
  _: unknown,
  { input }: { input: SmartPlaylistInput },
  _ctx: ConnectionContext,
): Promise<{
  meta: {
    type: SmartPlaylistType;
    userId: string;
    userName: string;
    userAvatar: string | null;
    climbCount: number;
  };
  climbs: Climb[];
  totalCount: number;
  hasMore: boolean;
}> => {
  validateInput(GetSmartPlaylistInputSchema, input, 'input');

  const page = input.page ?? 0;
  const pageSize = input.pageSize ?? 20;

  const [user] = await db
    .select({
      id: dbSchema.users.id,
      name: dbSchema.users.name,
      image: dbSchema.users.image,
      displayName: dbSchema.userProfiles.displayName,
      avatarUrl: dbSchema.userProfiles.avatarUrl,
    })
    .from(dbSchema.users)
    .leftJoin(dbSchema.userProfiles, eq(dbSchema.userProfiles.userId, dbSchema.users.id))
    .where(eq(dbSchema.users.id, input.userId))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const [pageRefs, totalCount] = await Promise.all([
    selectSmartClimbRefs(input.type, input.userId, input.boardName, page, pageSize),
    countSmartClimbRefs(input.type, input.userId, input.boardName),
  ]);
  const hasMore = (page + 1) * pageSize < totalCount;
  const climbs = await hydrateClimbs(pageRefs);

  return {
    meta: {
      type: input.type,
      userId: user.id,
      userName: user.displayName || user.name || 'Climber',
      userAvatar: user.avatarUrl || user.image || null,
      climbCount: totalCount,
    },
    climbs,
    totalCount,
    hasMore,
  };
};

/**
 * Climb counts for the current user's smart playlists, used to render
 * the cards on the library page.
 *
 * TODO: collapse into a single SQL roundtrip. Today this fires three queries
 * in parallel (FIVE_STARS, MOST_REPEATED, PROJECTS), and the MOST_REPEATED
 * helper uses a wrapped subquery so its branch costs two roundtrips on its
 * own. Cheap at current scale; consider a single CTE-backed query if it
 * shows up in profiling.
 */
export const mySmartPlaylistCounts = async (
  _: unknown,
  __: unknown,
  ctx: ConnectionContext,
): Promise<Array<{ type: SmartPlaylistType; count: number }>> => {
  requireAuthenticated(ctx);
  const userId = ctx.userId!;

  const [fiveStars, mostRepeated, projects] = await Promise.all([
    countSmartClimbRefs('FIVE_STARS', userId, undefined),
    countSmartClimbRefs('MOST_REPEATED', userId, undefined),
    countSmartClimbRefs('PROJECTS', userId, undefined),
  ]);

  return [
    { type: 'FIVE_STARS', count: fiveStars },
    { type: 'MOST_REPEATED', count: mostRepeated },
    { type: 'PROJECTS', count: projects },
  ];
};
