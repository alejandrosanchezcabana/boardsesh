-- board_climb_stats: continuously updated by Aurora syncs as people log ascents.
-- Tighten autovacuum so the visibility map stays fresh enough for the
-- ascents-DESC search query to use a true Index Only Scan (no heap fetches).
-- Default 0.2/0.1 scale factors mean autovacuum waits for ~120K dead tuples
-- before firing on this ~600K-row table; 0.02/0.01 brings that to ~12K dead.
ALTER TABLE board_climb_stats SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);
--> statement-breakpoint
-- board_climbs: lower modification rate (mostly inserts on new climbs +
-- denormalized-column backfills). 0.05/0.02 gives autovacuum a tighter trigger
-- than the default without making it run constantly.
ALTER TABLE board_climbs SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);
