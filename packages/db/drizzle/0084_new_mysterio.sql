ALTER TABLE "app_feedback" ADD COLUMN "board_name" text;--> statement-breakpoint
ALTER TABLE "app_feedback" ADD COLUMN "layout_id" integer;--> statement-breakpoint
ALTER TABLE "app_feedback" ADD COLUMN "size_id" integer;--> statement-breakpoint
ALTER TABLE "app_feedback" ADD COLUMN "set_ids" jsonb;--> statement-breakpoint
ALTER TABLE "app_feedback" ADD COLUMN "angle" integer;--> statement-breakpoint
ALTER TABLE "app_feedback" ADD COLUMN "context" jsonb;--> statement-breakpoint
CREATE INDEX "app_feedback_board_idx" ON "app_feedback" USING btree ("board_name");