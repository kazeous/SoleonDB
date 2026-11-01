CREATE TABLE "incident_effects" (
	"guild_id" text NOT NULL,
	"incident_id" uuid NOT NULL,
	"effect_key" text NOT NULL,
	"kind" text NOT NULL,
	"channel_id" text,
	"message_id" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"request" jsonb,
	"authorized_at" bigint,
	"completed_at" bigint,
	CONSTRAINT "incident_effects_guild_id_incident_id_effect_key_pk" PRIMARY KEY("guild_id","incident_id","effect_key")
);
--> statement-breakpoint
ALTER TABLE "moderation_incidents" ADD COLUMN "dispatch_token" uuid;--> statement-breakpoint
ALTER TABLE "incident_effects" ADD CONSTRAINT "incident_effects_guild_id_incident_id_moderation_incidents_guild_id_id_fk" FOREIGN KEY ("guild_id","incident_id") REFERENCES "moderation_incidents"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "effects_incident_state" ON "incident_effects" USING btree ("guild_id","incident_id","state");