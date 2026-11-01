CREATE TABLE "rule_matches" (
	"guild_id" text NOT NULL,
	"rule_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"message_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"matched_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"consumed_at" bigint,
	CONSTRAINT "rule_matches_guild_id_rule_id_revision_message_id_pk" PRIMARY KEY("guild_id","rule_id","revision","message_id")
);
--> statement-breakpoint
CREATE TABLE "guild_case_counters" (
	"guild_id" text PRIMARY KEY NOT NULL,
	"next_number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_cooldowns" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"until" bigint NOT NULL,
	"parent_incident_id" uuid NOT NULL,
	CONSTRAINT "member_cooldowns_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "moderation_cases" (
	"guild_id" text NOT NULL,
	"id" uuid NOT NULL,
	"number" integer NOT NULL,
	"target_id" text NOT NULL,
	"actor_id" text,
	"source" text NOT NULL,
	"action" text,
	"reason" text NOT NULL,
	"rule_snapshot" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	"outcome" jsonb,
	CONSTRAINT "moderation_cases_guild_id_id_pk" PRIMARY KEY("guild_id","id"),
	CONSTRAINT "case_guild_number" UNIQUE("guild_id","number")
);
--> statement-breakpoint
CREATE TABLE "moderation_incidents" (
	"guild_id" text NOT NULL,
	"id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"intent" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"worker_id" text,
	"lease_until" bigint,
	"created_at" bigint NOT NULL,
	CONSTRAINT "moderation_incidents_guild_id_id_pk" PRIMARY KEY("guild_id","id"),
	CONSTRAINT "incident_global_identity" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "rule_matches" ADD CONSTRAINT "rule_matches_guild_id_rule_id_channel_rules_guild_id_id_fk" FOREIGN KEY ("guild_id","rule_id") REFERENCES "channel_rules"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_case_counters" ADD CONSTRAINT "guild_case_counters_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_cooldowns" ADD CONSTRAINT "member_cooldowns_guild_id_parent_incident_id_moderation_incidents_guild_id_id_fk" FOREIGN KEY ("guild_id","parent_incident_id") REFERENCES "moderation_incidents"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_guild_id_id_moderation_incidents_guild_id_id_fk" FOREIGN KEY ("guild_id","id") REFERENCES "moderation_incidents"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_incidents" ADD CONSTRAINT "moderation_incidents_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_member_window" ON "rule_matches" USING btree ("guild_id","user_id","consumed_at","expires_at");--> statement-breakpoint
CREATE INDEX "matches_expiry" ON "rule_matches" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "cases_cursor" ON "moderation_cases" USING btree ("guild_id","created_at","id");--> statement-breakpoint
CREATE INDEX "cases_member" ON "moderation_cases" USING btree ("guild_id","target_id","created_at");--> statement-breakpoint
CREATE INDEX "incident_queue" ON "moderation_incidents" USING btree ("state","created_at","id");--> statement-breakpoint
CREATE INDEX "incidents_member" ON "moderation_incidents" USING btree ("guild_id","user_id","created_at");