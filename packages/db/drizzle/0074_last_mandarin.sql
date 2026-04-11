-- Track when a climb was first published (transitioned out of draft state).
-- Used by the create-climb form to gate the 24h post-publish edit window.
ALTER TABLE "board_climbs" ADD COLUMN "published_at" text;--> statement-breakpoint

-- Backfill: existing non-draft climbs are assumed to have been published at
-- their creation time. Drafts stay null.
UPDATE "board_climbs"
   SET "published_at" = "created_at"
 WHERE "is_draft" = false
   AND "published_at" IS NULL;
