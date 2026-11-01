CREATE TABLE "greeting_deliveries" (
	"guild_id" text NOT NULL,
	"event_key" text NOT NULL,
	"target" text NOT NULL,
	"state" text NOT NULL,
	"message_id" text,
	"created_at" bigint NOT NULL,
	CONSTRAINT "greeting_deliveries_guild_id_event_key_target_pk" PRIMARY KEY("guild_id","event_key","target")
);
--> statement-breakpoint
CREATE TABLE "greeting_memberships" (
	"guild_id" text NOT NULL,
	"user_id" text NOT NULL,
	"event_key" text NOT NULL,
	"state" text NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "greeting_memberships_guild_id_user_id_pk" PRIMARY KEY("guild_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "greeting_deliveries" ADD CONSTRAINT "greeting_deliveries_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "greeting_memberships" ADD CONSTRAINT "greeting_memberships_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "greeting_delivery_expiry" ON "greeting_deliveries" USING btree ("created_at");