ALTER TABLE "voice_rooms" ADD COLUMN "panel_state" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "voice_rooms" ADD COLUMN "panel_operation_id" uuid;
--> statement-breakpoint
UPDATE voice_rooms SET panel_state=CASE WHEN panel_id IS NOT NULL THEN 'sent' ELSE 'unknown' END,panel_operation_id=id;
