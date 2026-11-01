CREATE TABLE "role_picker_operations" (
	"guild_id" text NOT NULL,
	"id" text NOT NULL,
	"panel_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"user_id" text NOT NULL,
	"desired" boolean NOT NULL,
	"state" text NOT NULL,
	"created_at" bigint NOT NULL,
	"completed_at" bigint,
	CONSTRAINT "role_picker_operations_guild_id_id_pk" PRIMARY KEY("guild_id","id")
);
--> statement-breakpoint
CREATE TABLE "role_picker_options" (
	"guild_id" text NOT NULL,
	"panel_id" uuid NOT NULL,
	"role_id" text NOT NULL,
	"label" text NOT NULL,
	"emoji" text,
	"position" integer NOT NULL,
	CONSTRAINT "role_picker_options_guild_id_panel_id_role_id_pk" PRIMARY KEY("guild_id","panel_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "role_picker_panels" (
	"guild_id" text NOT NULL,
	"id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"message_id" text,
	"operation_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"state" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "role_picker_panels_guild_id_id_pk" PRIMARY KEY("guild_id","id"),
	CONSTRAINT "role_panel_message" UNIQUE("guild_id","message_id"),
	CONSTRAINT "role_panel_operation" UNIQUE("guild_id","operation_key")
);
--> statement-breakpoint
ALTER TABLE "role_picker_operations" ADD CONSTRAINT "role_picker_operations_guild_id_panel_id_role_id_role_picker_options_guild_id_panel_id_role_id_fk" FOREIGN KEY ("guild_id","panel_id","role_id") REFERENCES "role_picker_options"("guild_id","panel_id","role_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_picker_options" ADD CONSTRAINT "role_picker_options_guild_id_panel_id_role_picker_panels_guild_id_id_fk" FOREIGN KEY ("guild_id","panel_id") REFERENCES "role_picker_panels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_picker_panels" ADD CONSTRAINT "role_picker_panels_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_picker_panels" ADD CONSTRAINT "role_picker_panels_guild_id_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "role_picker_member_operations" ON "role_picker_operations" USING btree ("guild_id","user_id","role_id","state");--> statement-breakpoint
CREATE INDEX "role_picker_role_bindings" ON "role_picker_options" USING btree ("guild_id","role_id");