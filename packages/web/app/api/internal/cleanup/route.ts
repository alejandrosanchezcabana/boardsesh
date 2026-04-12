import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { dbz as db } from '@/app/lib/db/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Delete feed items older than 180 days
    const feedResult = await db.execute<{ count: string }>(
      sql`DELETE FROM feed_items WHERE created_at < NOW() - INTERVAL '180 days'`,
    );
    const feedDeleted = (feedResult as unknown as { rowCount?: number }).rowCount ?? 0;

    // Delete notifications older than 90 days
    const notifResult = await db.execute<{ count: string }>(
      sql`DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days'`,
    );
    const notifDeleted = (notifResult as unknown as { rowCount?: number }).rowCount ?? 0;

    return NextResponse.json({
      feedItemsDeleted: feedDeleted,
      notificationsDeleted: notifDeleted,
    });
  } catch (error) {
    console.error('[Cleanup cron] Error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 },
    );
  }
}
