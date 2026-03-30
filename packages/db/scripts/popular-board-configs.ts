import { createScriptDb } from './db-connection';
import { sql } from 'drizzle-orm';

async function main() {
  const { db, close } = createScriptDb();

  try {
    const rows = await db.execute(sql`
      SELECT
        configs.board_type,
        configs.layout_id,
        bl.name AS layout_name,
        configs.size_id,
        bps.name AS size_name,
        bps.description AS size_description,
        configs.set_ids,
        configs.set_names,
        COALESCE(cc.climb_count, 0) AS climb_count
      FROM (
        SELECT
          psls.board_type,
          psls.layout_id,
          psls.product_size_id AS size_id,
          array_agg(DISTINCT psls.set_id ORDER BY psls.set_id) AS set_ids,
          array_agg(DISTINCT bs.name ORDER BY bs.name) AS set_names
        FROM board_product_sizes_layouts_sets psls
        JOIN board_sets bs ON bs.board_type = psls.board_type AND bs.id = psls.set_id
        WHERE psls.is_listed = true
        GROUP BY psls.board_type, psls.layout_id, psls.product_size_id
      ) configs
      JOIN board_layouts bl ON bl.board_type = configs.board_type AND bl.id = configs.layout_id
      JOIN board_product_sizes bps ON bps.board_type = configs.board_type AND bps.id = configs.size_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS climb_count
        FROM board_climbs bc
        WHERE bc.board_type = configs.board_type
          AND bc.layout_id = configs.layout_id
          AND bc.is_listed = true
          AND bc.is_draft = false
          AND bc.edge_left > bps.edge_left
          AND bc.edge_right < bps.edge_right
          AND bc.edge_bottom > bps.edge_bottom
          AND bc.edge_top < bps.edge_top
      ) cc ON true
      WHERE bl.is_listed = true
        AND bps.is_listed = true
      ORDER BY climb_count DESC, configs.board_type, bl.name
    `);

    // db.execute() returns QueryResult with .rows for neon-serverless, or an array for postgres-js
    const rowsArray = Array.isArray(rows)
      ? (rows as Array<Record<string, unknown>>)
      : (rows as unknown as { rows: Array<Record<string, unknown>> }).rows;

    console.log(`Found ${rowsArray.length} board configurations:\n`);
    console.table(rowsArray);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('Error running popular board configs query:', err);
  process.exit(1);
});
