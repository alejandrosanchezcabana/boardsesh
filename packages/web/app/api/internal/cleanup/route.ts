import { NextResponse } from 'next/server';
import { lt, sql } from 'drizzle-orm';
import { dbz as db } from '@/app/lib/db/db';
import { feedItems, notifications } from '@boardsesh/db/schema';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db
      .delete(feedItems)
      .where(lt(feedItems.createdAt, sql`NOW() - INTERVAL '180 days'`));

    await db
      .delete(notifications)
      .where(lt(notifications.createdAt, sql`NOW() - INTERVAL '90 days'`));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Cleanup cron] Error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 },
    );
  }
}
