CREATE TYPE "public"."eval_verdict" AS ENUM('optimal', 'good', 'suboptimal', 'poor');--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "eval_score" integer;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "eval_verdict" "eval_verdict";--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "eval_explanation" text;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN "eval_post_op_note" text;