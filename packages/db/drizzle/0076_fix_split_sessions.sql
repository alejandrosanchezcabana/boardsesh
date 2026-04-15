-- Data-fix migration: Merge split sessions
--
-- When users logged climbs before starting a party session, the solo ticks
-- ended up in an inferred session while party ticks went to the party session.
-- This migration retroactively adopts inferred-session ticks into party sessions
-- when they occurred within 2 hours before the party session's first tick.
--
-- Safe to re-run: only moves ticks that still have session_id IS NULL.

-- Step 1: Move inferred ticks into party sessions where the gap is <= 2 hours.
-- Uses DISTINCT ON to pick the nearest party session when a user has multiple.
WITH party_session_bounds AS (
  SELECT
    bs.id AS party_session_id,
    bs.created_by_user_id AS user_id,
    MIN(bt.climbed_at) AS first_party_tick
  FROM board_sessions bs
  JOIN boardsesh_ticks bt ON bt.session_id = bs.id
  WHERE bs.created_by_user_id IS NOT NULL
  GROUP BY bs.id, bs.created_by_user_id
),
ticks_to_adopt AS (
  SELECT DISTINCT ON (bt.uuid)
    bt.uuid AS tick_uuid,
    bt.inferred_session_id,
    psb.party_session_id
  FROM boardsesh_ticks bt
  JOIN party_session_bounds psb ON bt.user_id = psb.user_id
  WHERE bt.session_id IS NULL
    AND bt.climbed_at >= psb.first_party_tick - INTERVAL '2 hours'
    AND bt.climbed_at < psb.first_party_tick
  ORDER BY bt.uuid, ABS(EXTRACT(EPOCH FROM (bt.climbed_at - psb.first_party_tick)))
)
UPDATE boardsesh_ticks
SET session_id = ta.party_session_id,
    inferred_session_id = NULL
FROM ticks_to_adopt ta
WHERE boardsesh_ticks.uuid = ta.tick_uuid;
--> statement-breakpoint

-- Step 2: Delete inferred sessions that now have zero ticks remaining
DELETE FROM inferred_sessions ins
WHERE NOT EXISTS (
  SELECT 1 FROM boardsesh_ticks bt
  WHERE bt.inferred_session_id = ins.id
)
AND ins.tick_count > 0;
--> statement-breakpoint

-- Step 3: Recalculate stats for inferred sessions that lost some ticks
UPDATE inferred_sessions ins
SET
  tick_count = sub.tick_count,
  total_sends = sub.total_sends,
  total_flashes = sub.total_flashes,
  total_attempts = sub.total_attempts,
  first_tick_at = sub.first_tick_at,
  last_tick_at = sub.last_tick_at
FROM (
  SELECT
    inferred_session_id,
    COUNT(*)::int AS tick_count,
    COUNT(*) FILTER (WHERE status IN ('flash', 'send'))::int AS total_sends,
    COUNT(*) FILTER (WHERE status = 'flash')::int AS total_flashes,
    COUNT(*) FILTER (WHERE status = 'attempt')::int AS total_attempts,
    MIN(climbed_at) AS first_tick_at,
    MAX(climbed_at) AS last_tick_at
  FROM boardsesh_ticks
  WHERE inferred_session_id IS NOT NULL
  GROUP BY inferred_session_id
) sub
WHERE ins.id = sub.inferred_session_id
  AND (
    ins.tick_count != sub.tick_count
    OR ins.total_sends != sub.total_sends
    OR ins.total_flashes != sub.total_flashes
    OR ins.total_attempts != sub.total_attempts
  );
