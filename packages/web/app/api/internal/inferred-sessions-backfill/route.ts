import { NextResponse } from 'next/server';
import { getDb } from '@/app/lib/db/db';
import { boardseshTicks } from '@/app/lib/db/schema';
import { and, isNull } from 'drizzle-orm';
import { buildInferredSessionsForUser } from '@/app/lib/data-sync/aurora/inferred-session-builder';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

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
    for (const { userId } of usersWithUnassigned) {
      const assigned = await buildInferredSessionsForUser(userId);
      totalAssigned += assigned;
    }

    return NextResponse.json({
      usersProcessed: usersWithUnassigned.length,
      ticksAssigned: totalAssigned,
    });
  } catch (error) {
    console.error('[Inferred sessions backfill] Error:', error);
    return NextResponse.json(
      { error: 'Backfill failed' },
      { status: 500 },
    );
  }
}
