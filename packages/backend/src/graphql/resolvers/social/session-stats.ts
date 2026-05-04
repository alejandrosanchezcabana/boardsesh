import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as dbSchema from '@boardsesh/db/schema';
import { rowsFromResult } from '@boardsesh/db/client';
import { db } from '../../../db/client';

const SessionStatsRowSchema = z.object({
  tick_count: z.coerce.number(),
  total_sends: z.coerce.number(),
  total_flashes: z.coerce.number(),
  total_attempts: z.coerce.number(),
  first_tick_at: z.string().nullable(),
  last_tick_at: z.string().nullable(),
});

/**
 * Recalculate aggregate stats for an inferred session from its current ticks.
 * Accepts an optional db/transaction connection — pass the transaction `tx`
 * when calling from within a db.transaction() to ensure consistent reads.
 */
export async function recalculateSessionStats(
  sessionId: string,
  conn: Pick<typeof db, 'execute' | 'update'> = db,
): Promise<void> {
  const result = await conn.execute(sql`
    SELECT
      COUNT(*) AS tick_count,
      COUNT(*) FILTER (WHERE status IN ('flash', 'send')) AS total_sends,
      COUNT(*) FILTER (WHERE status = 'flash') AS total_flashes,
      COUNT(*) FILTER (WHERE status = 'attempt') AS total_attempts,
      MIN(climbed_at) AS first_tick_at,
      MAX(climbed_at) AS last_tick_at
    FROM boardsesh_ticks
    WHERE inferred_session_id = ${sessionId}
  `);

  const rawRows = rowsFromResult<unknown>(result);
  const parsed = rawRows.length > 0 ? SessionStatsRowSchema.safeParse(rawRows[0]) : null;

  if (!parsed || !parsed.success || parsed.data.first_tick_at === null) {
    // No ticks remain — session is empty but keep it for reference
    await conn
      .update(dbSchema.inferredSessions)
      .set({
        tickCount: 0,
        totalSends: 0,
        totalFlashes: 0,
        totalAttempts: 0,
      })
      .where(eq(dbSchema.inferredSessions.id, sessionId));
    return;
  }

  const stats = parsed.data;
  await conn
    .update(dbSchema.inferredSessions)
    .set({
      tickCount: stats.tick_count,
      totalSends: stats.total_sends,
      totalFlashes: stats.total_flashes,
      totalAttempts: stats.total_attempts,
      firstTickAt: stats.first_tick_at!,
      lastTickAt: stats.last_tick_at!,
    })
    .where(eq(dbSchema.inferredSessions.id, sessionId));
}
