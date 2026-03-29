CREATE TYPE "public"."availability" AS ENUM('available', 'on_mission', 'resting');--> statement-breakpoint
CREATE TYPE "public"."health" AS ENUM('healthy', 'injured', 'down');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('pending', 'en_route', 'active', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."mission_outcome" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TABLE "dispatch_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"recommended_hero_ids" jsonb NOT NULL,
	"reasoning" varchar(2000) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heroes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"alias" varchar(100) NOT NULL,
	"threat" integer NOT NULL,
	"grit" integer NOT NULL,
	"presence" integer NOT NULL,
	"edge" integer NOT NULL,
	"tempo" integer NOT NULL,
	"availability" "availability" DEFAULT 'available' NOT NULL,
	"health" "health" DEFAULT 'healthy' NOT NULL,
	"cooldown_until" timestamp,
	"personality" varchar(2000) NOT NULL,
	"bio" varchar(1000) NOT NULL,
	"portrait_url" varchar(500),
	"missions_completed" integer DEFAULT 0 NOT NULL,
	"missions_failed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" varchar(1000) NOT NULL,
	"required_stats" jsonb NOT NULL,
	"slot_count" integer NOT NULL,
	"danger_level" integer NOT NULL,
	"mission_duration" integer NOT NULL,
	"expiry_duration" integer NOT NULL,
	"has_interrupt" boolean DEFAULT false NOT NULL,
	"interrupt_options" jsonb,
	"top_hero_id" uuid,
	"status" "incident_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mission_heroes" (
	"mission_id" uuid NOT NULL,
	"hero_id" uuid NOT NULL,
	CONSTRAINT "mission_heroes_mission_id_hero_id_pk" PRIMARY KEY("mission_id","hero_id")
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"outcome" "mission_outcome",
	"report" varchar(3000),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_health" integer DEFAULT 100 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "dispatch_recommendations" ADD CONSTRAINT "dispatch_recommendations_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_heroes" ADD CONSTRAINT "mission_heroes_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_heroes" ADD CONSTRAINT "mission_heroes_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."heroes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missions" ADD CONSTRAINT "missions_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;