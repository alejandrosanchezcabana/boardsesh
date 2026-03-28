import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { getPool } from '@/app/lib/db/db';
import { drizzle } from 'drizzle-orm/neon-serverless';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import {
  boardseshTicks,
  boardClimbs,
  boardClimbStats,
  playlists,
  playlistClimbs,
  playlistOwnership,
} from '@/app/lib/db/schema';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import { fontGradeToDifficultyId } from '@/app/lib/board-data';
import { buildInferredSessionsForUser } from './inferred-session-builder';

// ---------------------------------------------------------------------------
// Zod schema for the Aurora JSON export format
// ---------------------------------------------------------------------------

const auroraExportAscentSchema = z.object({
  climb: z.string(),
  angle: z.number(),
  count: z.number(),
  stars: z.number(),
  climbed_at: z.string(),
  created_at: z.string(),
  grade: z.string(),
});

const auroraExportAttemptSchema = z.object({
  climb: z.string(),
  angle: z.number(),
  count: z.number(),
  climbed_at: z.string(),
  created_at: z.string(),
});

const auroraExportCircuitSchema = z.object({
  name: z.string(),
  color: z.string(),
  created_at: z.string(),
  climbs: z.array(z.string()),
});

export const auroraExportSchema = z.object({
  user: z.object({
    username: z.string(),
    email_address: z.string().optional(),
    created_at: z.string().optional(),
  }),
  ascents: z.array(auroraExportAscentSchema).default([]),
  attempts: z.array(auroraExportAttemptSchema).default([]),
  circuits: z.array(auroraExportCircuitSchema).default([]),
  likes: z.array(z.object({ climb: z.string(), created_at: z.string() })).default([]),
  // Fields we don't import but should accept without error
  follows: z.array(z.any()).optional(),
  walls: z.array(z.any()).optional(),
  blocks: z.array(z.any()).optional(),
  beta_links: z.array(z.any()).optional(),
  climbs: z.array(z.any()).optional(),
  agreements: z.array(z.any()).optional(),
});

export type AuroraExportData = z.infer<typeof auroraExportSchema>;

type BoardType = 'kilter' | 'tension';

// ---------------------------------------------------------------------------
// Import result types
// ---------------------------------------------------------------------------

export interface ImportCounts {
  imported: number;
  skipped: number;
  failed: number;
}

export interface ImportResult {
  ascents: ImportCounts;
  attempts: ImportCounts;
  circuits: ImportCounts;
  unresolvedClimbs: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a timestamp to ISO format for consistent dedup key generation.
 * Drizzle returns timestamps as "2024-01-15 10:30:00" (no T, no Z),
 * while new Date().toISOString() produces "2024-01-15T10:30:00.000Z".
 * We normalize both to the same ISO format for reliable comparison.
 */
function normalizeTimestamp(ts: string): string {
  return new Date(ts).toISOString();
}

function generateJsonImportAuroraId(
  climbUuid: string,
  angle: number,
  climbedAt: string,
  type: 'ascents' | 'bids',
): string {
  const hash = createHash('sha256')
    .update(`${climbUuid}:${angle}:${climbedAt}:${type}`)
    .digest('hex')
    .slice(0, 32);
  return `json-import-${hash}`;
}

// ---------------------------------------------------------------------------
// Climb name resolution
// ---------------------------------------------------------------------------

async function resolveClimbNames(
  db: NeonDatabase<Record<string, never>>,
  boardType: BoardType,
  climbNames: string[],
): Promise<Map<string, string>> {
  if (climbNames.length === 0) return new Map();

  // Track best match across all chunks: name -> { uuid, ascensionistCount }
  const nameToMatch = new Map<string, { uuid: string; count: number }>();

  // Batch in chunks of 500 to avoid overly large IN clauses
  const chunkSize = 500;
  for (let i = 0; i < climbNames.length; i += chunkSize) {
    const chunk = climbNames.slice(i, i + chunkSize);

    // Query climbs with stats to pick the most popular when duplicates exist
    const results = await db
      .select({
        uuid: boardClimbs.uuid,
        name: boardClimbs.name,
        ascensionistCount: boardClimbStats.ascensionistCount,
      })
      .from(boardClimbs)
      .leftJoin(
        boardClimbStats,
        and(
          eq(boardClimbStats.climbUuid, boardClimbs.uuid),
          eq(boardClimbStats.boardType, boardClimbs.boardType),
        ),
      )
      .where(
        and(
          eq(boardClimbs.boardType, boardType),
          inArray(boardClimbs.name, chunk),
          eq(boardClimbs.isListed, true),
          eq(boardClimbs.isDraft, false),
        ),
      );

    for (const row of results) {
      if (!row.name) continue;

      const count = row.ascensionistCount ?? 0;
      const existing = nameToMatch.get(row.name);

      if (!existing || count > existing.count) {
        nameToMatch.set(row.name, { uuid: row.uuid, count });
      }
    }
  }

  // Convert to simple name -> uuid map
  const nameToUuid = new Map<string, string>();
  for (const [name, match] of nameToMatch) {
    nameToUuid.set(name, match.uuid);
  }
  return nameToUuid;
}

// ---------------------------------------------------------------------------
// Cross-source dedup: fetch existing tick keys for this user + board
// ---------------------------------------------------------------------------

async function getExistingTickKeys(
  db: NeonDatabase<Record<string, never>>,
  userId: string,
  boardType: BoardType,
): Promise<Set<string>> {
  const existing = await db
    .select({
      climbUuid: boardseshTicks.climbUuid,
      angle: boardseshTicks.angle,
      climbedAt: boardseshTicks.climbedAt,
    })
    .from(boardseshTicks)
    .where(
      and(
        eq(boardseshTicks.userId, userId),
        eq(boardseshTicks.boardType, boardType),
      ),
    );

  const keys = new Set<string>();
  for (const row of existing) {
    // Normalize timestamp format so DB rows and import data produce matching keys
    const normalized = normalizeTimestamp(row.climbedAt);
    keys.add(`${row.climbUuid}:${row.angle}:${normalized}`);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Main import function
// ---------------------------------------------------------------------------

export async function importJsonExportData(
  userId: string,
  boardType: BoardType,
  data: AuroraExportData,
): Promise<ImportResult> {
  const result: ImportResult = {
    ascents: { imported: 0, skipped: 0, failed: 0 },
    attempts: { imported: 0, skipped: 0, failed: 0 },
    circuits: { imported: 0, skipped: 0, failed: 0 },
    unresolvedClimbs: [],
  };

  // Capture a single "now" for all timestamps in this import
  const now = new Date().toISOString();

  // Step 1: Collect all unique climb names
  const allClimbNames = new Set<string>();
  for (const a of data.ascents) allClimbNames.add(a.climb);
  for (const a of data.attempts) allClimbNames.add(a.climb);
  for (const c of data.circuits) {
    for (const name of c.climbs) allClimbNames.add(name);
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const db = drizzle(client);

    // Step 2: Resolve climb names to UUIDs
    const nameToUuid = await resolveClimbNames(db, boardType, [...allClimbNames]);

    // Track unresolved names
    for (const name of allClimbNames) {
      if (!nameToUuid.has(name)) {
        result.unresolvedClimbs.push(name);
      }
    }

    // Step 3: Get existing tick keys for cross-source dedup
    const existingKeys = await getExistingTickKeys(db, userId, boardType);

    // Step 4: Import ascents and attempts in a transaction
    await client.query('BEGIN');

    try {
      for (const ascent of data.ascents) {
        const climbUuid = nameToUuid.get(ascent.climb);
        if (!climbUuid) {
          result.ascents.failed++;
          continue;
        }

        const climbedAt = normalizeTimestamp(ascent.climbed_at);
        const tickKey = `${climbUuid}:${ascent.angle}:${climbedAt}`;

        // Cross-source dedup
        if (existingKeys.has(tickKey)) {
          result.ascents.skipped++;
          continue;
        }

        const auroraId = generateJsonImportAuroraId(climbUuid, ascent.angle, climbedAt, 'ascents');
        const status = ascent.count === 1 ? 'flash' : 'send';
        // The JSON export 'stars' field is already on a 1-5 scale (user-facing),
        // unlike the Aurora API 'quality' field which is 0-3.
        const quality = ascent.stars;
        const difficulty = fontGradeToDifficultyId(ascent.grade);

        await db
          .insert(boardseshTicks)
          .values({
            uuid: randomUUID(),
            userId,
            boardType,
            climbUuid,
            angle: ascent.angle,
            isMirror: false,
            status,
            attemptCount: ascent.count,
            quality,
            difficulty,
            isBenchmark: false,
            comment: '',
            climbedAt,
            createdAt: ascent.created_at ? normalizeTimestamp(ascent.created_at) : now,
            updatedAt: now,
            auroraType: 'ascents',
            auroraId,
            auroraSyncedAt: now,
          })
          .onConflictDoUpdate({
            target: boardseshTicks.auroraId,
            set: {
              climbUuid,
              angle: ascent.angle,
              status,
              attemptCount: ascent.count,
              quality,
              difficulty,
              climbedAt,
              updatedAt: now,
              auroraSyncedAt: now,
            },
          });

        existingKeys.add(tickKey);
        result.ascents.imported++;
      }

      // Step 5: Import attempts
      for (const attempt of data.attempts) {
        const climbUuid = nameToUuid.get(attempt.climb);
        if (!climbUuid) {
          result.attempts.failed++;
          continue;
        }

        const climbedAt = normalizeTimestamp(attempt.climbed_at);
        const tickKey = `${climbUuid}:${attempt.angle}:${climbedAt}`;

        if (existingKeys.has(tickKey)) {
          result.attempts.skipped++;
          continue;
        }

        const auroraId = generateJsonImportAuroraId(climbUuid, attempt.angle, climbedAt, 'bids');

        await db
          .insert(boardseshTicks)
          .values({
            uuid: randomUUID(),
            userId,
            boardType,
            climbUuid,
            angle: attempt.angle,
            isMirror: false,
            status: 'attempt',
            attemptCount: attempt.count,
            quality: null,
            difficulty: null,
            isBenchmark: false,
            comment: '',
            climbedAt,
            createdAt: attempt.created_at ? normalizeTimestamp(attempt.created_at) : now,
            updatedAt: now,
            auroraType: 'bids',
            auroraId,
            auroraSyncedAt: now,
          })
          .onConflictDoUpdate({
            target: boardseshTicks.auroraId,
            set: {
              climbUuid,
              angle: attempt.angle,
              attemptCount: attempt.count,
              climbedAt,
              updatedAt: now,
              auroraSyncedAt: now,
            },
          });

        existingKeys.add(tickKey);
        result.attempts.imported++;
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    // Step 6: Import circuits as playlists (separate transaction per circuit
    // so one failure doesn't roll back others or abort the tick transaction)
    for (const circuit of data.circuits) {
      const resolvedClimbs: string[] = [];
      for (const climbName of circuit.climbs) {
        const uuid = nameToUuid.get(climbName);
        if (uuid) resolvedClimbs.push(uuid);
      }

      const circuitHash = createHash('sha256')
        .update(`${boardType}:${circuit.name}:${circuit.created_at}`)
        .digest('hex')
        .slice(0, 32);
      const circuitAuroraId = `json-import-circuit-${circuitHash}`;
      const formattedColor = circuit.color ? `#${circuit.color}` : null;
      const circuitNow = new Date();

      try {
        await client.query('BEGIN');

        const [playlist] = await db
          .insert(playlists)
          .values({
            uuid: randomUUID(),
            boardType,
            layoutId: null,
            name: circuit.name,
            description: null,
            isPublic: false,
            color: formattedColor,
            auroraType: 'circuits',
            auroraId: circuitAuroraId,
            auroraSyncedAt: circuitNow,
            createdAt: circuit.created_at ? new Date(circuit.created_at) : circuitNow,
            updatedAt: circuitNow,
          })
          .onConflictDoUpdate({
            target: playlists.auroraId,
            set: {
              name: circuit.name,
              isPublic: false,
              color: formattedColor,
              updatedAt: circuitNow,
              auroraSyncedAt: circuitNow,
            },
          })
          .returning({ id: playlists.id });

        await db
          .insert(playlistOwnership)
          .values({
            playlistId: playlist.id,
            userId,
            role: 'owner',
          })
          .onConflictDoNothing();

        await db.delete(playlistClimbs).where(eq(playlistClimbs.playlistId, playlist.id));

        for (let i = 0; i < resolvedClimbs.length; i++) {
          await db.insert(playlistClimbs).values({
            playlistId: playlist.id,
            climbUuid: resolvedClimbs[i],
            angle: null,
            position: i,
          });
        }

        await client.query('COMMIT');
        result.circuits.imported++;
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Failed to import circuit "${circuit.name}":`, error);
        result.circuits.failed++;
      }
    }

    // Step 7: Build inferred sessions for imported ticks
    if (result.ascents.imported > 0 || result.attempts.imported > 0) {
      try {
        const assigned = await buildInferredSessionsForUser(userId);
        if (assigned > 0) {
          console.log(`Built inferred sessions: assigned ${assigned} ticks for user ${userId}`);
        }
      } catch (error) {
        console.error('Error building inferred sessions after JSON import:', error);
      }
    }

    return result;
  } finally {
    client.release();
  }
}
