CREATE TABLE "starboard_mappings" (
	"guild_id" text NOT NULL,
	"source_message_id" text NOT NULL,
	"source_channel_id" text NOT NULL,
	"destination_id" text NOT NULL,
	"repost_id" text,
	"operation_id" uuid NOT NULL,
	"state" text NOT NULL,
	"star_count" integer DEFAULT 0 NOT NULL,
	"source_deleted" boolean DEFAULT false NOT NULL,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"last_synced_at" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "starboard_mappings_guild_id_source_message_id_pk" PRIMARY KEY("guild_id","source_message_id")
);
--> statement-breakpoint
ALTER TABLE "starboard_mappings" ADD CONSTRAINT "starboard_mappings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starboard_mappings" ADD CONSTRAINT "starboard_mappings_guild_id_source_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","source_channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starboard_mappings" ADD CONSTRAINT "starboard_mappings_guild_id_destination_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","destination_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "starboard_reconcile" ON "starboard_mappings" USING btree ("guild_id","last_synced_at");