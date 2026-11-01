CREATE TABLE "auto_threads" (
	"guild_id" text NOT NULL,
	"message_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"thread_id" text,
	"state" text NOT NULL,
	"settings_revision" integer NOT NULL,
	"name" text NOT NULL,
	"auto_archive_duration" integer NOT NULL,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"last_attempt_at" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "auto_threads_guild_id_message_id_pk" PRIMARY KEY("guild_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "auto_threads" ADD CONSTRAINT "auto_threads_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_threads" ADD CONSTRAINT "auto_threads_guild_id_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auto_thread_recovery" ON "auto_threads" USING btree ("guild_id","state","last_attempt_at");