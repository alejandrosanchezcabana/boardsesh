CREATE TABLE "user_climb_percentiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"total_distinct_climbs" integer DEFAULT 0 NOT NULL,
	"percentile" double precision DEFAULT 0 NOT NULL,
	"total_active_users" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_climb_percentiles" ADD CONSTRAINT "user_climb_percentiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_climbs_user_id_idx" ON "board_climbs" USING btree ("user_id") WHERE "board_climbs"."user_id" IS NOT NULL AND "board_climbs"."is_draft" = false;--> statement-breakpoint
-- NOTE: initial population of user_climb_percentiles is left to the weekly cron
-- at /api/internal/profile-percentiles to avoid a multi-minute scan of
-- boardsesh_ticks at deploy time. Table is read-tolerant of an empty state.
