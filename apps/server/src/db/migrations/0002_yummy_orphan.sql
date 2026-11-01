CREATE TABLE "channel_rules" (
	"guild_id" text NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"enabled" boolean NOT NULL,
	"config" jsonb NOT NULL,
	"deleted_at" bigint,
	CONSTRAINT "channel_rules_guild_id_id_pk" PRIMARY KEY("guild_id","id")
);
--> statement-breakpoint
ALTER TABLE "channel_rules" ADD CONSTRAINT "channel_rules_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_rules" ADD CONSTRAINT "channel_rules_guild_id_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rules_channel_enabled" ON "channel_rules" USING btree ("guild_id","channel_id","enabled");