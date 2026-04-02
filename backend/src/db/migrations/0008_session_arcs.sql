ALTER TABLE "sessions" ADD COLUMN "arc_seeds" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "incident_limit" integer;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "incident_count" integer DEFAULT 0 NOT NULL;