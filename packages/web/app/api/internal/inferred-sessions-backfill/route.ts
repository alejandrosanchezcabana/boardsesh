import { NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db/db';
import { boardseshTicks } from '@/app/lib/db/schema';
import { and, isNull } from 'drizzle-orm';
import { buildInferredSessionsForUser } from '@/app/lib/data-sync/aurora/inferred-session-builder';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

// Leave a 30s buffer before the Vercel timeout to return a partial result
const DEADLINE_MS = (maxDuration - 30) * 1000;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const startedAt = Date.now();

    // Find users with orphaned ticks (failed immediate assignment)
    const usersWithUnassigned = await db
      .selectDistinct({ userId: boardseshTicks.userId })
      .from(boardseshTicks)
      .where(
        and(
          isNull(boardseshTicks.sessionId),
          isNull(boardseshTicks.inferredSessionId),
        ),
      );

    if (usersWithUnassigned.length === 0) {
      return NextResponse.json({
        usersProcessed: 0,
        ticksAssigned: 0,
      });
    }

    let totalAssigned = 0;
    let usersProcessed = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    for (const { userId } of usersWithUnassigned) {
      // Stop processing before we hit the Vercel timeout
      if (Date.now() - startedAt > DEADLINE_MS) {
        console.log(
          `[Inferred sessions backfill] Deadline reached after ${usersProcessed}/${usersWithUnassigned.length} users`,
        );
        break;
      }

      try {
        const assigned = await buildInferredSessionsForUser(userId);
        totalAssigned += assigned;
        usersProcessed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Inferred sessions backfill] Failed for user ${userId}:`, message);
        errors.push({ userId, error: message });
      }
    }

    return NextResponse.json({
      usersProcessed,
      usersTotal: usersWithUnassigned.length,
      ticksAssigned: totalAssigned,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Inferred sessions backfill] Error:', error);
    return NextResponse.json(
      { error: 'Backfill failed' },
      { status: 500 },
    );
  }
}
