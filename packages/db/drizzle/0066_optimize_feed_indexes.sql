-- Expression index on effective session ID (COALESCE of session_id, inferred_session_id)
-- Enables index usage for batch enrichment queries that use this COALESCE pattern
-- instead of falling back to sequential scans on the entire boardsesh_ticks table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "boardsesh_ticks_effective_session_idx"
  ON "boardsesh_ticks" (COALESCE(session_id, inferred_session_id))
  WHERE COALESCE(session_id, inferred_session_id) IS NOT NULL;
--> statement-breakpoint

-- Missing index on feed_items(entity_type, entity_id)
-- The vote_counts trigger queries feed_items by (entity_type, entity_id)
-- on every vote INSERT/UPDATE/DELETE but no index existed, causing sequential scans.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "feed_items_entity_type_entity_id_idx"
  ON "feed_items" (entity_type, entity_id);
