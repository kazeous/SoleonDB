CREATE TABLE "verification_assignments" (
	"guild_id" text NOT NULL,
	"generation" integer NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"normal" boolean NOT NULL,
	"burst" boolean NOT NULL,
	"role_granted" boolean NOT NULL,
	"bot_granted" boolean NOT NULL,
	"prior_role" boolean NOT NULL,
	"retired_eligible" boolean NOT NULL,
	"operation" text NOT NULL,
	"transfer_role_id" text,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "verification_assignments_guild_id_generation_user_id_pk" PRIMARY KEY("guild_id","generation","user_id")
);
--> statement-breakpoint
CREATE TABLE "verification_panels" (
	"guild_id" text NOT NULL,
	"generation" integer NOT NULL,
	"channel_id" text NOT NULL,
	"role_id" text NOT NULL,
	"emoji_key" text NOT NULL,
	"emoji_render" text NOT NULL,
	"message_id" text,
	"active" boolean DEFAULT false NOT NULL,
	"state" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	CONSTRAINT "verification_panels_guild_id_generation_pk" PRIMARY KEY("guild_id","generation"),
	CONSTRAINT "verification_message_identity" UNIQUE("guild_id","message_id"),
	CONSTRAINT "verification_generation_role" UNIQUE("guild_id","generation","role_id")
);
--> statement-breakpoint
ALTER TABLE "verification_assignments" ADD CONSTRAINT "verification_assignments_guild_id_generation_role_id_verification_panels_guild_id_generation_role_id_fk" FOREIGN KEY ("guild_id","generation","role_id") REFERENCES "verification_panels"("guild_id","generation","role_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_panels" ADD CONSTRAINT "verification_panels_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_panels" ADD CONSTRAINT "verification_panels_guild_id_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_member_assignments" ON "verification_assignments" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_active_panel" ON "verification_panels" USING btree ("guild_id") WHERE active;