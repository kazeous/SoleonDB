CREATE TABLE "configuration_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"feature" text NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_settings" (
	"guild_id" text NOT NULL,
	"feature" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"value" jsonb NOT NULL,
	"log_channel_id" text,
	CONSTRAINT "feature_settings_guild_id_feature_pk" PRIMARY KEY("guild_id","feature"),
	CONSTRAINT "settings_revision_positive" CHECK (revision > 0)
);
--> statement-breakpoint
CREATE TABLE "guild_channels" (
	"guild_id" text NOT NULL,
	"id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "guild_channels_guild_id_id_pk" PRIMARY KEY("guild_id","id")
);
--> statement-breakpoint
CREATE TABLE "guilds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"icon_url" text,
	"active" boolean DEFAULT false NOT NULL,
	"bot_present" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "configuration_audit" ADD CONSTRAINT "configuration_audit_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_settings" ADD CONSTRAINT "feature_settings_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_settings" ADD CONSTRAINT "feature_settings_guild_id_log_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","log_channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_channels" ADD CONSTRAINT "guild_channels_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_guild_time" ON "configuration_audit" USING btree ("guild_id","created_at","id");