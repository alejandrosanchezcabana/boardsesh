/**
 * Backfill `board_beta_links.thumbnail` so legacy direct-bucket URLs become
 * backend-relative `/static/beta-link-thumbnails/...` URLs.
 *
 * Why: Tigris on Railway (`t3.storageapi.dev/<bucket>/...`) does not honor
 * the `ACL: 'public-read'` we set on PutObject, so the direct bucket URLs
 * we previously persisted return 403 in the browser. The new pipeline
 * serves thumbnails through the backend's `handleStaticBetaThumbnail`
 * handler at `/static/beta-link-thumbnails/<platform>/<id>.jpg`, which
 * streams the object from S3 server-side. The S3 objects themselves stay
 * where they are — only the URL we surface to clients changes.
 *
 * Idempotent: only touches rows whose thumbnail still starts with the
 * legacy bucket endpoint. Re-running is a no-op once everything is
 * migrated.
 *
 * Usage:
 *   bun run packages/db/scripts/backfill-beta-link-thumbnail-urls.ts [--dry-run]
 *
 * Notes:
 *   - The bucket endpoint is read from AWS_ENDPOINT_URL + AWS_S3_BUCKET_NAME
 *     (the same env vars the backend uses).
 *   - Falls back to scanning by the literal `/beta-link-thumbnails/` path
 *     fragment if those env vars aren't set, so the script still works in a
 *     pinch when run with only DATABASE_URL.
 */

import { sql } from 'drizzle-orm';
import { createScriptDb } from './db-connection.js';

const dryRun = process.argv.includes('--dry-run');

function getLegacyPrefix(): string | null {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!endpoint || !bucket) return null;
  return `${endpoint.replace(/\/$/, '')}/${bucket}/`;
}

async function main(): Promise<void> {
  const { db, close } = createScriptDb();
  const legacyPrefix = getLegacyPrefix();

  try {
    if (legacyPrefix) {
      console.info(`[backfill] Rewriting thumbnails matching prefix: ${legacyPrefix}beta-link-thumbnails/`);
    } else {
      console.info(
        '[backfill] AWS_ENDPOINT_URL / AWS_S3_BUCKET_NAME not set — falling back to a path-fragment match. Set them for a tighter scope.',
      );
    }

    const previewResult = await db.execute(
      legacyPrefix
        ? sql`
            SELECT thumbnail, COUNT(*)::int AS n
            FROM board_beta_links
            WHERE thumbnail LIKE ${legacyPrefix + 'beta-link-thumbnails/%'}
            GROUP BY thumbnail
            ORDER BY thumbnail
            LIMIT 10
          `
        : sql`
            SELECT thumbnail, COUNT(*)::int AS n
            FROM board_beta_links
            WHERE thumbnail LIKE 'http%/beta-link-thumbnails/%'
              AND thumbnail NOT LIKE '/static/%'
            GROUP BY thumbnail
            ORDER BY thumbnail
            LIMIT 10
          `,
    );
    const previewRows = (previewResult as unknown as { rows?: Array<{ thumbnail: string; n: number }> }).rows ?? [];
    console.info(`[backfill] Sample of rows that would be rewritten (up to 10):`);
    for (const r of previewRows) {
      console.info(`  ${r.thumbnail} (×${r.n})`);
    }

    if (dryRun) {
      console.info('[backfill] --dry-run: skipping update');
      return;
    }

    const updateResult = legacyPrefix
      ? await db.execute(sql`
          UPDATE board_beta_links
          SET thumbnail = REPLACE(thumbnail, ${legacyPrefix}, '/static/')
          WHERE thumbnail LIKE ${legacyPrefix + 'beta-link-thumbnails/%'}
        `)
      : await db.execute(sql`
          UPDATE board_beta_links
          SET thumbnail = '/static/' || SUBSTRING(thumbnail FROM POSITION('/beta-link-thumbnails/' IN thumbnail) + 1)
          WHERE thumbnail LIKE 'http%/beta-link-thumbnails/%'
            AND thumbnail NOT LIKE '/static/%'
        `);

    const rowCount = (updateResult as unknown as { rowCount?: number; count?: number }).rowCount ?? 0;
    console.info(`[backfill] Rewrote ${rowCount} thumbnail URLs.`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('[backfill] failed:', err);
  process.exit(1);
});
