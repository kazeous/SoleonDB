CREATE TABLE "automod_messages" (
	"guild_id" text NOT NULL,
	"revision" integer NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"observed_at" bigint NOT NULL,
	"violation_at" bigint,
	"consumed_at" bigint,
	"expires_at" bigint NOT NULL,
	CONSTRAINT "automod_messages_guild_id_revision_message_id_pk" PRIMARY KEY("guild_id","revision","message_id")
);
--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "moderation_incidents" ADD COLUMN "operation_key" text;--> statement-breakpoint
ALTER TABLE "automod_messages" ADD CONSTRAINT "automod_messages_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "automod_member_window" ON "automod_messages" USING btree ("guild_id","revision","user_id","observed_at");--> statement-breakpoint
CREATE INDEX "automod_expiry" ON "automod_messages" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "moderation_incidents" ADD CONSTRAINT "incident_operation_identity" UNIQUE("guild_id","operation_key");