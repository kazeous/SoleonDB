CREATE TABLE "social_reposts" (
	"guild_id" text NOT NULL,
	"source_message_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"settings_revision" integer NOT NULL,
	"state" text NOT NULL,
	"mode" text NOT NULL,
	"copy_id" text,
	"original_delete_state" text DEFAULT 'not_requested' NOT NULL,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"last_attempt_at" bigint NOT NULL,
	CONSTRAINT "social_reposts_guild_id_source_message_id_pk" PRIMARY KEY("guild_id","source_message_id"),
	CONSTRAINT "social_operation" UNIQUE("guild_id","operation_id")
);
--> statement-breakpoint
ALTER TABLE "social_reposts" ADD CONSTRAINT "social_reposts_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_reposts" ADD CONSTRAINT "social_reposts_guild_id_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "social_recovery" ON "social_reposts" USING btree ("guild_id","state","last_attempt_at");