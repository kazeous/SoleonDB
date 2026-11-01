CREATE TABLE "oauth_states" (
	"state_hash" text PRIMARY KEY NOT NULL,
	"session_hash" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_sessions" (
	"id_hash" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oauth_state_expiry" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_expiry" ON "owner_sessions" USING btree ("expires_at");