-- Add denormalized columns to board_climbs for fast set and size filtering
ALTER TABLE "board_climbs" ADD COLUMN "required_set_ids" integer[];--> statement-breakpoint
ALTER TABLE "board_climbs" ADD COLUMN "compatible_size_ids" integer[];--> statement-breakpoint

-- Populate required_set_ids: which hold sets does each climb need?
-- Derived from climb_holds -> placements -> set_id
UPDATE board_climbs c SET required_set_ids = sub.sets
FROM (
  SELECT bch.board_type, bch.climb_uuid,
    ARRAY_AGG(DISTINCT bp.set_id ORDER BY bp.set_id) as sets
  FROM board_climb_holds bch
  JOIN board_placements bp
    ON bp.id = bch.hold_id AND bp.board_type = bch.board_type
  JOIN board_climbs cl
    ON cl.uuid = bch.climb_uuid AND cl.board_type = bch.board_type
    AND cl.layout_id = bp.layout_id
  WHERE bch.board_type != 'moonboard'
  GROUP BY bch.board_type, bch.climb_uuid
) sub
WHERE c.uuid = sub.climb_uuid AND c.board_type = sub.board_type;--> statement-breakpoint

-- Populate compatible_size_ids: which product sizes can display each climb?
-- A climb fits a size if its edges are contained within the size's edges
UPDATE board_climbs c SET compatible_size_ids = sub.size_ids
FROM (
  SELECT c2.uuid, c2.board_type,
    ARRAY_AGG(ps.id ORDER BY ps.id) as size_ids
  FROM board_climbs c2
  JOIN board_product_sizes ps
    ON ps.board_type = c2.board_type
    AND c2.edge_left > ps.edge_left
    AND c2.edge_right < ps.edge_right
    AND c2.edge_bottom > ps.edge_bottom
    AND c2.edge_top < ps.edge_top
  WHERE c2.board_type != 'moonboard'
    AND c2.edge_left IS NOT NULL
  GROUP BY c2.uuid, c2.board_type
) sub
WHERE c.uuid = sub.uuid AND c.board_type = sub.board_type;--> statement-breakpoint

-- GIN indexes for fast array containment queries
CREATE INDEX "board_climbs_required_set_ids_idx" ON "board_climbs" USING gin ("required_set_ids");--> statement-breakpoint
CREATE INDEX "board_climbs_compatible_size_ids_idx" ON "board_climbs" USING gin ("compatible_size_ids");
