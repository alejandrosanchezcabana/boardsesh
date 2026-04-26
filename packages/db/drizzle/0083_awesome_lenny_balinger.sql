ALTER TYPE "public"."social_entity_type" ADD VALUE 'beta_video';--> statement-breakpoint
CREATE TABLE "boardsesh_beta_videos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"uuid" text NOT NULL,
	"user_id" text,
	"board_type" text NOT NULL,
	"climb_uuid" text NOT NULL,
	"angle" integer,
	"bunny_video_id" text NOT NULL,
	"bunny_library_id" text NOT NULL,
	"title" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"thumbnail_url" text,
	"duration" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "boardsesh_beta_videos_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
ALTER TABLE "boardsesh_beta_videos" ADD CONSTRAINT "boardsesh_beta_videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "boardsesh_beta_videos_climb_idx" ON "boardsesh_beta_videos" USING btree ("board_type","climb_uuid");--> statement-breakpoint
CREATE INDEX "boardsesh_beta_videos_user_idx" ON "boardsesh_beta_videos" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "boardsesh_beta_videos_bunny_video_idx" ON "boardsesh_beta_videos" USING btree ("bunny_video_id");