CREATE TABLE "voice_rooms" (
	"guild_id" text NOT NULL,
	"id" uuid NOT NULL,
	"hub_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"parent_id" text,
	"channel_id" text,
	"panel_id" text,
	"state" text NOT NULL,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "voice_rooms_guild_id_id_pk" PRIMARY KEY("guild_id","id"),
	CONSTRAINT "voice_room_channel" UNIQUE("guild_id","channel_id")
);
--> statement-breakpoint
ALTER TABLE "voice_rooms" ADD CONSTRAINT "voice_rooms_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_rooms" ADD CONSTRAINT "voice_rooms_guild_id_hub_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","hub_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "voice_room_recovery" ON "voice_rooms" USING btree ("guild_id","state","lease_until");