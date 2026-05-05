import { sharedSync } from '../api/shared-sync-api';
import { type SyncOptions, type AuroraBoardName, SHARED_SYNC_TABLES } from '../api/types';
import { sql, eq, inArray } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import type {
  Attempt,
  BetaLink,
  Climb,
  ClimbStats,
  Hole,
  Kit,
  Layout,
  Led,
  Placement,
  PlacementRole,
  Product,
  ProductSize,
  ProductSizesLayoutsSet,
  Set as AuroraSet,
  SharedSync,
  SyncPutFields,
} from '../api/sync-api-types';
import { UNIFIED_TABLES } from '../db/table-select';
import { convertLitUpHoldsStringToMap } from '@boardsesh/board-constants/hold-states';
import { populateDenormalizedColumns } from '@boardsesh/db/queries';
import { setterFollows, notifications, userBoardMappings, userFollows } from '@boardsesh/db/schema';
import { randomUUID } from 'crypto';

type DrizzleDb = PostgresJsDatabase<Record<string, never>>;

export type NewClimbInfo = {
  uuid: string;
  setterId?: number;
  setterUsername?: string;
  layoutId: number;
  name?: string;
};

// Tables we actually want to process and store, in FK-safe upsert order.
// SHARED_SYNC_TABLES matches the Android app's request order for indistinguishability,
// but that order is not FK-safe — e.g. `product_sizes_layouts_sets` appears before
// `sets` even though the former FKs to the latter. Iterate this list in the upsert
// loop instead. The Aurora API request still uses SHARED_SYNC_TABLES.
//
// Out of scope here:
// - `products_angles`: angles are hardcoded in the `ANGLES` constant in board-data.ts.
const PROCESSING_ORDER: string[] = [
  'products',
  'sets',
  'product_sizes',
  'holes',
  'layouts',
  'placement_roles',
  'leds',
  'placements',
  'product_sizes_layouts_sets',
  'climbs',
  'climb_stats',
  'beta_links',
  'attempts',
  'kits',
];

const TABLES_TO_PROCESS = new Set([...PROCESSING_ORDER, 'shared_syncs']);

const MAX_SYNC_ATTEMPTS = 100;

const upsertProducts = (db: DrizzleDb, board: AuroraBoardName, data: Product[]) =>
  Promise.all(
    data.map((item) => {
      const productsSchema = UNIFIED_TABLES.products;
      return db
        .insert(productsSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          name: item.name,
          isListed: Boolean(item.is_listed),
          password: item.password,
          minCountInFrame: Number(item.min_count_in_frame),
          maxCountInFrame: Number(item.max_count_in_frame),
        })
        .onConflictDoUpdate({
          target: [productsSchema.boardType, productsSchema.id],
          set: {
            name: item.name,
            isListed: Boolean(item.is_listed),
            password: item.password,
            minCountInFrame: Number(item.min_count_in_frame),
            maxCountInFrame: Number(item.max_count_in_frame),
          },
        });
    }),
  );

const upsertSets = (db: DrizzleDb, board: AuroraBoardName, data: AuroraSet[]) =>
  Promise.all(
    data.map((item) => {
      const setsSchema = UNIFIED_TABLES.sets;
      return db
        .insert(setsSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          name: item.name,
          hsm: Number(item.hsm),
        })
        .onConflictDoUpdate({
          target: [setsSchema.boardType, setsSchema.id],
          set: { name: item.name, hsm: Number(item.hsm) },
        });
    }),
  );

const upsertHoles = (db: DrizzleDb, board: AuroraBoardName, data: Hole[]) =>
  Promise.all(
    data.map((item) => {
      const holesSchema = UNIFIED_TABLES.holes;
      return db
        .insert(holesSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          productId: Number(item.product_id),
          name: item.name,
          x: Number(item.x),
          y: Number(item.y),
          mirroredHoleId: item.mirrored_hole_id != null ? Number(item.mirrored_hole_id) : null,
          mirrorGroup: Number(item.mirror_group),
        })
        .onConflictDoUpdate({
          target: [holesSchema.boardType, holesSchema.id],
          set: {
            productId: Number(item.product_id),
            name: item.name,
            x: Number(item.x),
            y: Number(item.y),
            mirroredHoleId: item.mirrored_hole_id != null ? Number(item.mirrored_hole_id) : null,
            mirrorGroup: Number(item.mirror_group),
          },
        });
    }),
  );

const upsertLayouts = (db: DrizzleDb, board: AuroraBoardName, data: Layout[]) =>
  Promise.all(
    data.map((item) => {
      const layoutsSchema = UNIFIED_TABLES.layouts;
      return db
        .insert(layoutsSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          productId: Number(item.product_id),
          name: item.name,
          instagramCaption: item.instagram_caption,
          isMirrored: Boolean(item.is_mirrored),
          isListed: Boolean(item.is_listed),
          password: item.password,
          createdAt: item.created_at,
        })
        .onConflictDoUpdate({
          target: [layoutsSchema.boardType, layoutsSchema.id],
          set: {
            productId: Number(item.product_id),
            name: item.name,
            instagramCaption: item.instagram_caption,
            isMirrored: Boolean(item.is_mirrored),
            isListed: Boolean(item.is_listed),
            password: item.password,
            createdAt: item.created_at,
          },
        });
    }),
  );

const upsertPlacementRoles = (db: DrizzleDb, board: AuroraBoardName, data: PlacementRole[]) =>
  Promise.all(
    data.map((item) => {
      const placementRolesSchema = UNIFIED_TABLES.placementRoles;
      return db
        .insert(placementRolesSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          productId: Number(item.product_id),
          position: Number(item.position),
          name: item.name,
          fullName: item.full_name,
          ledColor: item.led_color,
          screenColor: item.screen_color,
        })
        .onConflictDoUpdate({
          target: [placementRolesSchema.boardType, placementRolesSchema.id],
          set: {
            productId: Number(item.product_id),
            position: Number(item.position),
            name: item.name,
            fullName: item.full_name,
            ledColor: item.led_color,
            screenColor: item.screen_color,
          },
        });
    }),
  );

const upsertLeds = (db: DrizzleDb, board: AuroraBoardName, data: Led[]) =>
  Promise.all(
    data.map((item) => {
      const ledsSchema = UNIFIED_TABLES.leds;
      return db
        .insert(ledsSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          productSizeId: Number(item.product_size_id),
          holeId: Number(item.hole_id),
          position: Number(item.position),
        })
        .onConflictDoUpdate({
          target: [ledsSchema.boardType, ledsSchema.id],
          set: {
            productSizeId: Number(item.product_size_id),
            holeId: Number(item.hole_id),
            position: Number(item.position),
          },
        });
    }),
  );

const upsertPlacements = (db: DrizzleDb, board: AuroraBoardName, data: Placement[]) =>
  Promise.all(
    data.map((item) => {
      const placementsSchema = UNIFIED_TABLES.placements;
      return db
        .insert(placementsSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          layoutId: Number(item.layout_id),
          holeId: Number(item.hole_id),
          setId: Number(item.set_id),
          defaultPlacementRoleId:
            item.default_placement_role_id != null ? Number(item.default_placement_role_id) : null,
        })
        .onConflictDoUpdate({
          target: [placementsSchema.boardType, placementsSchema.id],
          set: {
            layoutId: Number(item.layout_id),
            holeId: Number(item.hole_id),
            setId: Number(item.set_id),
            defaultPlacementRoleId:
              item.default_placement_role_id != null ? Number(item.default_placement_role_id) : null,
          },
        });
    }),
  );

const upsertKits = (db: DrizzleDb, board: AuroraBoardName, data: Kit[]) =>
  Promise.all(
    data.map((item) => {
      const kitsSchema = UNIFIED_TABLES.kits;
      return db
        .insert(kitsSchema)
        .values({
          boardType: board,
          serialNumber: item.serial_number,
          name: item.name,
          isAutoconnect: Boolean(item.is_autoconnect),
          isListed: Boolean(item.is_listed),
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })
        .onConflictDoUpdate({
          target: [kitsSchema.boardType, kitsSchema.serialNumber],
          set: {
            name: item.name,
            isAutoconnect: Boolean(item.is_autoconnect),
            isListed: Boolean(item.is_listed),
            updatedAt: item.updated_at,
          },
        });
    }),
  );

const upsertProductSizesLayoutsSets = (db: DrizzleDb, board: AuroraBoardName, data: ProductSizesLayoutsSet[]) =>
  Promise.all(
    data.map((item) => {
      const pslsSchema = UNIFIED_TABLES.productSizesLayoutsSets;
      return db
        .insert(pslsSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          productSizeId: Number(item.product_size_id),
          layoutId: Number(item.layout_id),
          setId: Number(item.set_id),
          imageFilename: item.image_filename,
          isListed: Boolean(item.is_listed),
        })
        .onConflictDoUpdate({
          target: [pslsSchema.boardType, pslsSchema.id],
          set: {
            productSizeId: Number(item.product_size_id),
            layoutId: Number(item.layout_id),
            setId: Number(item.set_id),
            imageFilename: item.image_filename,
            isListed: Boolean(item.is_listed),
          },
        });
    }),
  );

const upsertProductSizes = (db: DrizzleDb, board: AuroraBoardName, data: ProductSize[]) =>
  Promise.all(
    data.map((item) => {
      const productSizesSchema = UNIFIED_TABLES.productSizes;
      return db
        .insert(productSizesSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          productId: Number(item.product_id),
          edgeLeft: Number(item.edge_left),
          edgeRight: Number(item.edge_right),
          edgeBottom: Number(item.edge_bottom),
          edgeTop: Number(item.edge_top),
          name: item.name,
          description: item.description,
          imageFilename: item.image_filename,
          position: Number(item.position),
          isListed: Boolean(item.is_listed),
        })
        .onConflictDoUpdate({
          target: [productSizesSchema.boardType, productSizesSchema.id],
          set: {
            productId: Number(item.product_id),
            edgeLeft: Number(item.edge_left),
            edgeRight: Number(item.edge_right),
            edgeBottom: Number(item.edge_bottom),
            edgeTop: Number(item.edge_top),
            name: item.name,
            description: item.description,
            imageFilename: item.image_filename,
            position: Number(item.position),
            isListed: Boolean(item.is_listed),
          },
        });
    }),
  );

const upsertAttempts = (db: DrizzleDb, board: AuroraBoardName, data: Attempt[]) =>
  Promise.all(
    data.map(async (item) => {
      const attemptsSchema = UNIFIED_TABLES.attempts;
      return db
        .insert(attemptsSchema)
        .values({
          boardType: board,
          id: Number(item.id),
          position: Number(item.position),
          name: item.name,
        })
        .onConflictDoUpdate({
          target: [attemptsSchema.boardType, attemptsSchema.id],
          set: {
            // Only allow position updates if they're reasonable (0-100); guard against hostile remote updates
            position: sql`CASE WHEN ${Number(item.position)} >= 0 AND ${Number(item.position)} <= 100 THEN ${Number(item.position)} ELSE ${attemptsSchema.position} END`,
            name: item.name,
          },
        });
    }),
  );

async function upsertClimbStats(db: DrizzleDb, board: AuroraBoardName, data: ClimbStats[]) {
  const climbStatsSchema = UNIFIED_TABLES.climbStats;
  const climbStatHistorySchema = UNIFIED_TABLES.climbStatsHistory;

  await Promise.all(
    data.map((item) =>
      Promise.all([
        db
          .insert(climbStatsSchema)
          .values({
            boardType: board,
            climbUuid: item.climb_uuid,
            angle: Number(item.angle),
            displayDifficulty: Number(item.display_difficulty || item.difficulty_average),
            benchmarkDifficulty: item.benchmark_difficulty != null ? Number(item.benchmark_difficulty) : null,
            ascensionistCount: Number(item.ascensionist_count),
            difficultyAverage: Number(item.difficulty_average),
            qualityAverage: Number(item.quality_average),
            faUsername: item.fa_username,
            faAt: item.fa_at,
          })
          .onConflictDoUpdate({
            target: [climbStatsSchema.boardType, climbStatsSchema.climbUuid, climbStatsSchema.angle],
            set: {
              displayDifficulty: Number(item.display_difficulty || item.difficulty_average),
              benchmarkDifficulty: item.benchmark_difficulty != null ? Number(item.benchmark_difficulty) : null,
              ascensionistCount: Number(item.ascensionist_count),
              difficultyAverage: Number(item.difficulty_average),
              qualityAverage: Number(item.quality_average),
              faUsername: item.fa_username,
              faAt: item.fa_at,
            },
          }),

        db.insert(climbStatHistorySchema).values({
          boardType: board,
          climbUuid: item.climb_uuid,
          angle: Number(item.angle),
          displayDifficulty: Number(item.display_difficulty || item.difficulty_average),
          benchmarkDifficulty: item.benchmark_difficulty != null ? Number(item.benchmark_difficulty) : null,
          ascensionistCount: Number(item.ascensionist_count),
          difficultyAverage: Number(item.difficulty_average),
          qualityAverage: Number(item.quality_average),
          faUsername: item.fa_username,
          faAt: item.fa_at,
        }),
      ]),
    ),
  );
}

async function upsertBetaLinks(db: DrizzleDb, board: AuroraBoardName, data: BetaLink[]) {
  const betaLinksSchema = UNIFIED_TABLES.betaLinks;

  await Promise.all(
    data.map((item) =>
      db
        .insert(betaLinksSchema)
        .values({
          boardType: board,
          climbUuid: item.climb_uuid,
          link: item.link,
          foreignUsername: item.foreign_username,
          angle: item.angle,
          thumbnail: item.thumbnail,
          isListed: item.is_listed,
          createdAt: item.created_at,
        })
        .onConflictDoUpdate({
          target: [betaLinksSchema.boardType, betaLinksSchema.climbUuid, betaLinksSchema.link],
          set: {
            foreignUsername: item.foreign_username,
            angle: item.angle,
            thumbnail: item.thumbnail,
            isListed: item.is_listed,
            createdAt: item.created_at,
          },
        }),
    ),
  );
}

async function upsertClimbs(db: DrizzleDb, board: AuroraBoardName, data: Climb[]): Promise<NewClimbInfo[]> {
  const climbsSchema = UNIFIED_TABLES.climbs;
  const climbHoldsSchema = UNIFIED_TABLES.climbHolds;

  if (data.length === 0) return [];

  const uuids = data.map((c) => c.uuid);
  const existingRows = await db
    .select({ uuid: climbsSchema.uuid })
    .from(climbsSchema)
    .where(inArray(climbsSchema.uuid, uuids));
  const existingUuids = new Set(existingRows.map((r) => r.uuid));

  await Promise.all(
    data.map(async (item: Climb) => {
      await db
        .insert(climbsSchema)
        .values({
          uuid: item.uuid,
          boardType: board,
          name: item.name,
          description: item.description,
          hsm: item.hsm,
          edgeLeft: item.edge_left,
          edgeRight: item.edge_right,
          edgeBottom: item.edge_bottom,
          edgeTop: item.edge_top,
          framesCount: item.frames_count,
          framesPace: item.frames_pace,
          frames: item.frames,
          setterId: item.setter_id,
          setterUsername: item.setter_username,
          layoutId: item.layout_id,
          isDraft: item.is_draft,
          isListed: item.is_listed,
          createdAt: item.created_at,
          angle: item.angle,
        })
        .onConflictDoUpdate({
          target: [climbsSchema.uuid],
          set: {
            // Only allow isDraft to flip false -> true (publishing)
            isDraft: sql`CASE WHEN ${climbsSchema.isDraft} = false AND ${item.is_draft} = true THEN true ELSE ${climbsSchema.isDraft} END`,
            // Only allow isListed to flip false -> true (making public)
            isListed: sql`CASE WHEN ${climbsSchema.isListed} = false AND ${item.is_listed} = true THEN true ELSE ${climbsSchema.isListed} END`,
            name: item.name,
            description: item.description,
            // Preserve all core climb data — never allow hostile updates to these critical fields
            hsm: climbsSchema.hsm,
            edgeLeft: climbsSchema.edgeLeft,
            edgeRight: climbsSchema.edgeRight,
            edgeBottom: climbsSchema.edgeBottom,
            edgeTop: climbsSchema.edgeTop,
            framesCount: climbsSchema.framesCount,
            framesPace: climbsSchema.framesPace,
            frames: climbsSchema.frames,
            setterId: climbsSchema.setterId,
            setterUsername: climbsSchema.setterUsername,
            layoutId: climbsSchema.layoutId,
            angle: climbsSchema.angle,
          },
        });

      const holdsByFrame = convertLitUpHoldsStringToMap(item.frames, board);

      const holdsToInsert = Object.entries(holdsByFrame).flatMap(([frameNumber, holds]) =>
        Object.entries(holds).map(([holdId, { state }]) => ({
          boardType: board,
          climbUuid: item.uuid,
          frameNumber: Number(frameNumber),
          holdId: Number(holdId),
          holdState: state,
        })),
      );

      if (holdsToInsert.length > 0) {
        await db.insert(climbHoldsSchema).values(holdsToInsert).onConflictDoNothing();
      }
    }),
  );

  await populateDenormalizedColumns(db, board, uuids);

  return data
    .filter((c) => !existingUuids.has(c.uuid))
    .map((c) => ({
      uuid: c.uuid,
      setterId: c.setter_id,
      setterUsername: c.setter_username,
      layoutId: c.layout_id,
      name: c.name,
    }));
}

async function upsertSharedTableData(
  db: DrizzleDb,
  boardName: AuroraBoardName,
  tableName: string,
  data: SyncPutFields[],
  log: (message: string) => void,
): Promise<NewClimbInfo[]> {
  switch (tableName) {
    case 'attempts':
      await upsertAttempts(db, boardName, data as Attempt[]);
      return [];
    case 'products':
      await upsertProducts(db, boardName, data as Product[]);
      return [];
    case 'sets':
      await upsertSets(db, boardName, data as AuroraSet[]);
      return [];
    case 'product_sizes':
      await upsertProductSizes(db, boardName, data as ProductSize[]);
      return [];
    case 'holes':
      await upsertHoles(db, boardName, data as Hole[]);
      return [];
    case 'layouts':
      await upsertLayouts(db, boardName, data as Layout[]);
      return [];
    case 'placement_roles':
      await upsertPlacementRoles(db, boardName, data as PlacementRole[]);
      return [];
    case 'leds':
      await upsertLeds(db, boardName, data as Led[]);
      return [];
    case 'product_sizes_layouts_sets':
      await upsertProductSizesLayoutsSets(db, boardName, data as ProductSizesLayoutsSet[]);
      return [];
    case 'placements':
      await upsertPlacements(db, boardName, data as Placement[]);
      return [];
    case 'kits':
      await upsertKits(db, boardName, data as Kit[]);
      return [];
    case 'climb_stats':
      await upsertClimbStats(db, boardName, data as ClimbStats[]);
      return [];
    case 'beta_links':
      await upsertBetaLinks(db, boardName, data as BetaLink[]);
      return [];
    case 'climbs':
      return upsertClimbs(db, boardName, data as Climb[]);
    case 'shared_syncs':
      await updateSharedSyncs(db, boardName, data as SharedSync[]);
      return [];
    default:
      log(`Table ${tableName} not handled in upsertSharedTableData`);
      return [];
  }
}

async function updateSharedSyncs(tx: DrizzleDb, boardName: AuroraBoardName, sharedSyncs: SharedSync[]) {
  const sharedSyncsSchema = UNIFIED_TABLES.sharedSyncs;

  for (const sync of sharedSyncs) {
    await tx
      .insert(sharedSyncsSchema)
      .values({
        boardType: boardName,
        tableName: sync.table_name,
        lastSynchronizedAt: sync.last_synchronized_at,
      })
      .onConflictDoUpdate({
        target: [sharedSyncsSchema.boardType, sharedSyncsSchema.tableName],
        set: {
          lastSynchronizedAt: sync.last_synchronized_at,
        },
      });
  }
}

async function getAllSharedSyncTimes(db: DrizzleDb, boardName: AuroraBoardName) {
  const sharedSyncsSchema = UNIFIED_TABLES.sharedSyncs;

  return db
    .select({
      table_name: sharedSyncsSchema.tableName,
      last_synchronized_at: sharedSyncsSchema.lastSynchronizedAt,
    })
    .from(sharedSyncsSchema)
    .where(eq(sharedSyncsSchema.boardType, boardName));
}

export type SharedSyncResult = {
  complete: boolean;
  results: Record<string, { synced: number; complete: boolean }>;
  newClimbs: NewClimbInfo[];
};

/**
 * Sync shared (non-user-specific) board data — products, sizes, layouts, climbs,
 * climb stats, beta links, etc. Uses the supplied `token` (typically a fresh
 * user token from the daemon) to authenticate against Aurora's `/sync` endpoint.
 *
 * Loops until the response's `_complete` flag is true, persisting each batch
 * before requesting the next. After a successful sync, fires setter-follow
 * notifications for any newly-published climbs.
 */
export async function syncSharedData(
  pgClient: ReturnType<typeof postgres>,
  board: AuroraBoardName,
  token: string,
  log: (message: string) => void = console.info,
): Promise<SharedSyncResult> {
  const db = drizzle(pgClient);

  const allSyncTimes = await getAllSharedSyncTimes(db, board);
  const sharedSyncMap = new Map(allSyncTimes.map((sync) => [sync.table_name, sync.last_synchronized_at]));

  const defaultTimestamp = '1970-01-01 00:00:00.000000';

  let currentSyncParams: SyncOptions = {
    sharedSyncs: SHARED_SYNC_TABLES.map((tableName) => ({
      table_name: tableName,
      last_synchronized_at: sharedSyncMap.get(tableName) || defaultTimestamp,
    })),
  };

  const totalResults: Record<string, { synced: number; complete: boolean }> = {};
  const allNewClimbs: NewClimbInfo[] = [];
  let isComplete = false;
  let attempts = 0;

  while (!isComplete && attempts < MAX_SYNC_ATTEMPTS) {
    attempts++;
    log(`[SharedSync] Batch ${attempts} for ${board}`);

    const syncResults = await sharedSync(board, currentSyncParams, token);

    await db.transaction(async (tx) => {
      const txDb = tx as unknown as DrizzleDb;

      for (const tableName of PROCESSING_ORDER) {
        const data = syncResults[tableName];
        if (!Array.isArray(data)) continue;
        log(`[SharedSync] ${tableName}: ${data.length} records`);
        const newClimbs = await upsertSharedTableData(txDb, board, tableName, data as SyncPutFields[], log);
        allNewClimbs.push(...newClimbs);
        if (!totalResults[tableName]) {
          totalResults[tableName] = { synced: 0, complete: false };
        }
        totalResults[tableName].synced += data.length;
      }

      // Track every requested table so totalResults stays comparable across runs.
      for (const tableName of SHARED_SYNC_TABLES) {
        if (TABLES_TO_PROCESS.has(tableName)) {
          if (!totalResults[tableName]) {
            totalResults[tableName] = { synced: 0, complete: false };
          }
          continue;
        }
        const data = syncResults[tableName];
        if (Array.isArray(data) && data.length > 0) {
          log(`[SharedSync] Skipping ${tableName}: ${data.length} records (not processed)`);
        }
        if (!totalResults[tableName]) {
          totalResults[tableName] = { synced: 0, complete: false };
        }
      }

      const newSharedSyncs = syncResults['shared_syncs'];
      if (Array.isArray(newSharedSyncs)) {
        await updateSharedSyncs(txDb, board, newSharedSyncs as SharedSync[]);

        currentSyncParams = {
          ...currentSyncParams,
          sharedSyncs: (newSharedSyncs as SharedSync[]).map((sync) => ({
            table_name: sync.table_name,
            last_synchronized_at: sync.last_synchronized_at,
          })),
        };
      }
    });

    isComplete = syncResults._complete !== false;
    if (!isComplete) {
      log(`[SharedSync] Batch ${attempts} not complete, continuing...`);
    }
  }

  if (attempts >= MAX_SYNC_ATTEMPTS && !isComplete) {
    log(`[SharedSync] Reached max attempts (${MAX_SYNC_ATTEMPTS}) for ${board} without seeing _complete`);
  }

  Object.keys(totalResults).forEach((table) => {
    totalResults[table].complete = isComplete;
  });

  log(
    `[SharedSync] ${board} complete in ${attempts} batch(es); ${allNewClimbs.length} new climb(s); per-table: ${
      Object.entries(totalResults)
        .filter(([, r]) => r.synced > 0)
        .map(([t, r]) => `${t}=${r.synced}`)
        .join(', ') || 'no changes'
    }`,
  );

  if (allNewClimbs.length > 0) {
    try {
      await createSetterSyncNotifications(db, board, allNewClimbs, log);
    } catch (error) {
      log(
        `[SharedSync] Failed to create setter notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { complete: isComplete, results: totalResults, newClimbs: allNewClimbs };
}

/**
 * Create batched notifications for setter followers when new climbs are synced.
 * Mirrors the behavior previously in the web shared-sync route.
 */
async function createSetterSyncNotifications(
  db: DrizzleDb,
  boardName: AuroraBoardName,
  newClimbs: NewClimbInfo[],
  log: (message: string) => void,
): Promise<void> {
  const climbsBySetter = new Map<string, NewClimbInfo[]>();
  for (const climb of newClimbs) {
    if (!climb.setterUsername) continue;
    const existing = climbsBySetter.get(climb.setterUsername) ?? [];
    existing.push(climb);
    climbsBySetter.set(climb.setterUsername, existing);
  }

  if (climbsBySetter.size === 0) return;

  const setterUsernames = Array.from(climbsBySetter.keys());

  const followers = await db
    .select({
      followerId: setterFollows.followerId,
      setterUsername: setterFollows.setterUsername,
    })
    .from(setterFollows)
    .where(inArray(setterFollows.setterUsername, setterUsernames));

  const linkedMappings = await db
    .select({
      userId: userBoardMappings.userId,
      boardUsername: userBoardMappings.boardUsername,
    })
    .from(userBoardMappings)
    .where(inArray(userBoardMappings.boardUsername, setterUsernames));

  const linkedUsernameToUserId = new Map<string, string>();
  for (const mapping of linkedMappings) {
    if (mapping.boardUsername) {
      linkedUsernameToUserId.set(mapping.boardUsername, mapping.userId);
    }
  }

  const linkedUserIds = Array.from(linkedUsernameToUserId.values());
  let userFollowsList: Array<{ followerId: string; followingId: string }> = [];
  if (linkedUserIds.length > 0) {
    userFollowsList = await db
      .select({
        followerId: userFollows.followerId,
        followingId: userFollows.followingId,
      })
      .from(userFollows)
      .where(inArray(userFollows.followingId, linkedUserIds));
  }

  for (const [setterUsername, climbs] of climbsBySetter) {
    const recipientIds = new Set<string>();

    for (const follow of followers) {
      if (follow.setterUsername === setterUsername) {
        recipientIds.add(follow.followerId);
      }
    }

    const linkedUserId = linkedUsernameToUserId.get(setterUsername);
    if (linkedUserId) {
      for (const follow of userFollowsList) {
        if (follow.followingId === linkedUserId) {
          recipientIds.add(follow.followerId);
        }
      }
    }

    if (recipientIds.size === 0) continue;

    const firstClimbUuid = climbs[0].uuid;
    const notificationValues = Array.from(recipientIds).map((recipientId) => ({
      uuid: randomUUID(),
      recipientId,
      actorId: linkedUserId ?? null,
      type: 'new_climbs_synced' as const,
      entityType: 'climb' as const,
      entityId: firstClimbUuid,
    }));

    await db.insert(notifications).values(notificationValues);
    log(
      `[SharedSync] Created ${notificationValues.length} notifications for setter "${setterUsername}" (${climbs.length} new climbs on ${boardName})`,
    );
  }
}
