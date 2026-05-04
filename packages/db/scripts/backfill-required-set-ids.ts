/**
 * Backfill NULL required_set_ids and compatible_size_ids on board_climbs.
 *
 * Finds all climbs where either denormalized column is NULL, then calls
 * populateDenormalizedColumns() in batches. Safe to re-run — only touches
 * rows that still have NULL values.
 *
 * Usage:
 *   bun run packages/db/scripts/backfill-required-set-ids.ts [--board kilter] [--batch-size 500] [--dry-run]
 */

import { sql } from 'drizzle-orm';
import { createScriptDb } from './db-connection.js';
import { populateDenormalizedColumns } from '../src/queries/climbs/populate-denormalized-columns.js';

function rows<T>(result: unknown): T[] {
  return result as T[];
}

const args = process.argv.slice(2);
const boardFilter = args.includes('--board') ? args[args.indexOf('--board') + 1] : undefined;
const batchSize = args.includes('--batch-size') ? Number(args[args.indexOf('--batch-size') + 1]) : 500;
const dryRun = args.includes('--dry-run');

async function main() {
  const { db, close } = createScriptDb();

  try {
    // Find board types that have NULL denormalized columns
    const boardTypesResult = await db.execute(sql`
      SELECT board_type, COUNT(*) as null_count
      FROM board_climbs
      WHERE (required_set_ids IS NULL OR compatible_size_ids IS NULL)
        AND frames IS NOT NULL
        AND frames != ''
        AND board_type != 'moonboard'
      GROUP BY board_type
      ORDER BY board_type
    `);

    const boardTypes = rows<{ board_type: string; null_count: string }>(boardTypesResult);

    if (boardTypes.length === 0) {
      console.info('No climbs with NULL denormalized columns found. Nothing to do.');
      return;
    }

    console.info('Climbs with NULL denormalized columns:');
    for (const bt of boardTypes) {
      console.info(`  ${bt.board_type}: ${Number(bt.null_count).toLocaleString()}`);
    }
    console.info('');

    if (dryRun) {
      console.info('Dry run — no changes will be made.');
      return;
    }

    for (const bt of boardTypes) {
      if (boardFilter && bt.board_type !== boardFilter) continue;

      const totalNull = Number(bt.null_count);
      let processed = 0;

      console.info(`\nBackfilling ${bt.board_type} (${totalNull.toLocaleString()} climbs)...`);

      while (true) {
        // Fetch a batch of UUIDs with NULL denormalized columns
        const batchResult = await db.execute(sql`
          SELECT uuid
          FROM board_climbs
          WHERE board_type = ${bt.board_type}
            AND (required_set_ids IS NULL OR compatible_size_ids IS NULL)
            AND frames IS NOT NULL
            AND frames != ''
          LIMIT ${batchSize}
        `);

        const uuids = rows<{ uuid: string }>(batchResult).map((r) => r.uuid);
        if (uuids.length === 0) break;

        await populateDenormalizedColumns(db, bt.board_type, uuids);
        processed += uuids.length;

        const pct = totalNull > 0 ? ((processed / totalNull) * 100).toFixed(1) : '100';
        console.info(`  ${processed.toLocaleString()} / ${totalNull.toLocaleString()} (${pct}%)`);
      }

      console.info(`  Done — ${processed.toLocaleString()} climbs updated.`);
    }

    // Verify
    console.info('\nVerification:');
    const remainingResult = await db.execute(sql`
      SELECT board_type, COUNT(*) as remaining
      FROM board_climbs
      WHERE (required_set_ids IS NULL OR compatible_size_ids IS NULL)
        AND frames IS NOT NULL
        AND frames != ''
        AND board_type != 'moonboard'
      GROUP BY board_type
      ORDER BY board_type
    `);

    const remaining = rows<{ board_type: string; remaining: string }>(remainingResult);
    if (remaining.length === 0) {
      console.info('  All denormalized columns populated.');
    } else {
      for (const r of remaining) {
        console.info(`  ${r.board_type}: ${Number(r.remaining).toLocaleString()} still NULL`);
      }
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
