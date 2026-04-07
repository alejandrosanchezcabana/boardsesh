ALTER TABLE "user_boards" ADD COLUMN "is_unlisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_boards" ADD COLUMN "hide_location" boolean DEFAULT false NOT NULL;