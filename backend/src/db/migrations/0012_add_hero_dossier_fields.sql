ALTER TABLE "heroes" ADD COLUMN "age" integer;--> statement-breakpoint
ALTER TABLE "heroes" ADD COLUMN "height" varchar(20);--> statement-breakpoint
ALTER TABLE "heroes" ADD COLUMN "labels" jsonb;