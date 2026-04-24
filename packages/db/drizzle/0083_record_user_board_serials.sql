CREATE TABLE "user_board_serials" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"serial_number" text NOT NULL,
	"board_name" text NOT NULL,
	"layout_id" bigint NOT NULL,
	"size_id" bigint NOT NULL,
	"set_ids" text NOT NULL,
	"board_uuid" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_board_serials" ADD CONSTRAINT "user_board_serials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_board_serials" ADD CONSTRAINT "user_board_serials_board_uuid_user_boards_uuid_fk" FOREIGN KEY ("board_uuid") REFERENCES "public"."user_boards"("uuid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_board_serials_unique_user_serial" ON "user_board_serials" USING btree ("user_id","serial_number");--> statement-breakpoint
CREATE INDEX "user_board_serials_serial_idx" ON "user_board_serials" USING btree ("serial_number");--> statement-breakpoint
CREATE INDEX "user_board_serials_board_uuid_idx" ON "user_board_serials" USING btree ("board_uuid");