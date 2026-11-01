CREATE TABLE "feed_deliveries" (
	"guild_id" text NOT NULL,
	"subscription_id" uuid NOT NULL,
	"generation" integer NOT NULL,
	"item_id" text NOT NULL,
	"item" jsonb NOT NULL,
	"channel_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"state" text NOT NULL,
	"message_id" text,
	"created_at" bigint NOT NULL,
	"completed_at" bigint,
	CONSTRAINT "feed_deliveries_guild_id_subscription_id_generation_item_id_pk" PRIMARY KEY("guild_id","subscription_id","generation","item_id"),
	CONSTRAINT "feed_delivery_operation" UNIQUE("guild_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "feed_subscriptions" (
	"guild_id" text NOT NULL,
	"id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"source" jsonb NOT NULL,
	"enabled" boolean NOT NULL,
	"poll_seconds" integer NOT NULL,
	"generation" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"initialized" boolean DEFAULT false NOT NULL,
	"cursor" text,
	"next_poll_at" bigint NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_result" jsonb,
	"last_success_at" bigint,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"claim_token" uuid,
	"deleted_at" bigint,
	CONSTRAINT "feed_subscriptions_guild_id_id_pk" PRIMARY KEY("guild_id","id"),
	CONSTRAINT "feed_subscription_global_id" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "feed_deliveries" ADD CONSTRAINT "feed_deliveries_guild_id_subscription_id_feed_subscriptions_guild_id_id_fk" FOREIGN KEY ("guild_id","subscription_id") REFERENCES "feed_subscriptions"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_deliveries" ADD CONSTRAINT "feed_deliveries_guild_id_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_subscriptions" ADD CONSTRAINT "feed_subscriptions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "guilds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_subscriptions" ADD CONSTRAINT "feed_subscriptions_guild_id_channel_id_guild_channels_guild_id_id_fk" FOREIGN KEY ("guild_id","channel_id") REFERENCES "guild_channels"("guild_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_delivery_recovery" ON "feed_deliveries" USING btree ("guild_id","subscription_id","state","created_at");--> statement-breakpoint
CREATE INDEX "feed_subscription_due" ON "feed_subscriptions" USING btree ("enabled","next_poll_at","lease_until");