CREATE TABLE "code_helper_prompts" (
	"guild_id" text NOT NULL,
	"source_message_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"author_id" text NOT NULL,
	"kind" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"format_operation_id" uuid NOT NULL,
	"prompt_id" text,
	"formatted_message_id" text,
	"state" text NOT NULL,
	"format_state" text DEFAULT 'idle' NOT NULL,
	"expires_at" bigint NOT NULL,
	"panel_disabled" boolean DEFAULT false NOT NULL,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"last_attempt_at" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "code_helper_prompts_guild_id_source_message_id_pk" PRIMARY KEY("guild_id","source_message_id"),
	CONSTRAINT "code_helper_prompt" UNIQUE("guild_id","prompt_id"),
	CONSTRAINT "code_helper_formatted_copy" UNIQUE("guild_id","formatted_message_id")
);
--> statement-breakpoint
ALTER TABLE "code_helper_prompts" ADD CONSTRAINT "code_helper_prompts_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_helper_prompts" ADD CONSTRAINT "code_helper_prompts_guild_id_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "code_helper_expiry" ON "code_helper_prompts" USING btree ("guild_id","expires_at","panel_disabled");