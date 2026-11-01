CREATE TABLE "suggestion_operations" (
	"guild_id" text NOT NULL,
	"id" text NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "suggestion_operations_guild_id_id_pk" PRIMARY KEY("guild_id","id")
);
--> statement-breakpoint
CREATE TABLE "suggestion_refresh_outbox" (
	"guild_id" text NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"desired_revision" integer NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" bigint DEFAULT 0 NOT NULL,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"claim_token" uuid,
	CONSTRAINT "suggestion_refresh_outbox_guild_id_suggestion_id_pk" PRIMARY KEY("guild_id","suggestion_id")
);
--> statement-breakpoint
CREATE TABLE "suggestion_status_history" (
	"guild_id" text NOT NULL,
	"id" uuid NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"previous_status" text NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "suggestion_status_history_guild_id_id_pk" PRIMARY KEY("guild_id","id")
);
--> statement-breakpoint
CREATE TABLE "suggestion_votes" (
	"guild_id" text NOT NULL,
	"suggestion_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"direction" text NOT NULL,
	CONSTRAINT "suggestion_votes_guild_id_suggestion_id_user_id_pk" PRIMARY KEY("guild_id","suggestion_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "suggestions" (
	"guild_id" text NOT NULL,
	"id" uuid NOT NULL,
	"operation_key" text NOT NULL,
	"channel_id" text NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"delivery_state" text NOT NULL,
	"message_id" text,
	"status" text DEFAULT 'voting' NOT NULL,
	"status_actor" text,
	"status_reason" text,
	"thread_wanted" boolean NOT NULL,
	"thread_id" text,
	"thread_state" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "suggestions_guild_id_id_pk" PRIMARY KEY("guild_id","id"),
	CONSTRAINT "suggestion_operation" UNIQUE("guild_id","operation_key"),
	CONSTRAINT "suggestion_message" UNIQUE("guild_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "suggestion_operations" ADD CONSTRAINT "suggestion_operations_guild_id_suggestion_id_suggestions_guild_id_id_fk" FOREIGN KEY ("guild_id","suggestion_id") REFERENCES "suggestions"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_refresh_outbox" ADD CONSTRAINT "suggestion_refresh_outbox_guild_id_suggestion_id_suggestions_guild_id_id_fk" FOREIGN KEY ("guild_id","suggestion_id") REFERENCES "suggestions"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_status_history" ADD CONSTRAINT "suggestion_status_history_guild_id_suggestion_id_suggestions_guild_id_id_fk" FOREIGN KEY ("guild_id","suggestion_id") REFERENCES "suggestions"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_votes" ADD CONSTRAINT "suggestion_votes_guild_id_suggestion_id_suggestions_guild_id_id_fk" FOREIGN KEY ("guild_id","suggestion_id") REFERENCES "suggestions"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_guild_id_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "suggestion_refresh_ready" ON "suggestion_refresh_outbox" USING btree ("next_attempt_at","lease_until");