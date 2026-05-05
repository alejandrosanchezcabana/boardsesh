CREATE TABLE "user_playlist_pins" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"playlist_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_playlist_pins" ADD CONSTRAINT "user_playlist_pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_playlist_pins" ADD CONSTRAINT "user_playlist_pins_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_playlist_pin" ON "user_playlist_pins" USING btree ("user_id","playlist_id");--> statement-breakpoint
CREATE INDEX "user_playlist_pins_user_idx" ON "user_playlist_pins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_playlist_pins_playlist_idx" ON "user_playlist_pins" USING btree ("playlist_id");