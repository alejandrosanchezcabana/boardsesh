import type { IncomingMessage, ServerResponse } from 'http';
import * as Sentry from '@sentry/node';
import { SyncRunner } from '@boardsesh/aurora-sync/runner';
import { applyCorsHeaders } from './cors';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Handle sync cron endpoint
 * Triggered by external cron service to sync the next user
 * Only syncs 1 user per call to avoid IP blocking from Aurora API
 */
export async function handleSyncCron(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Apply CORS headers
  if (!applyCorsHeaders(req, res)) return;

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Auth check - require CRON_SECRET in Authorization header
  const authHeader = req.headers['authorization'];
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  console.info('[Sync] Starting sync cron job (1 user)...');

  const runner = new SyncRunner({
    onLog: (msg: string) => console.info(`[Sync] ${msg}`),
    onError: (error: Error, context: { userId?: string; board?: string }) => {
      console.error(`[Sync] Error for ${context.userId}/${context.board}:`, error.message);
      Sentry.captureException(error, {
        tags: { source: 'aurora-sync', board: context.board },
        extra: { userId: context.userId },
      });
    },
  });

  try {
    const result = await runner.syncNextUser();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: true,
        results: {
          total: result.total,
          successful: result.successful,
          failed: result.failed,
        },
        errors: result.errors,
        timestamp: new Date().toISOString(),
      }),
    );

    console.info(`[Sync] Completed: ${result.successful}/${result.total} user synced`);
  } catch (error) {
    console.error('[Sync] Cron job failed:', error);
    Sentry.captureException(error, { tags: { source: 'sync-cron' } });
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    );
  } finally {
    await runner.close();
  }
}
