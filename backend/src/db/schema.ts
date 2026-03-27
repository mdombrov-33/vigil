import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import {
  availabilityEnum,
  healthEnum,
  incidentStatusEnum,
  missionOutcomeEnum,
} from "./enums.js";

// Sessions

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  cityHealth: integer("city_health").notNull().default(100),
  score: integer("score").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// Heroes

export const heroes = pgTable("heroes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  alias: varchar("alias", { length: 100 }).notNull(),
  // Stats
  threat: integer("threat").notNull(),
  grit: integer("grit").notNull(),
  presence: integer("presence").notNull(),
  edge: integer("edge").notNull(),
  tempo: integer("tempo").notNull(),
  // Status
  availability: availabilityEnum("availability").notNull().default("available"),
  health: healthEnum("health").notNull().default("healthy"),
  cooldownUntil: timestamp("cooldown_until"),
  // Profile (used as HeroAgent system prompt material)
  personality: varchar("personality", { length: 2000 }).notNull(),
  bio: varchar("bio", { length: 1000 }).notNull(),
  portraitUrl: varchar("portrait_url", { length: 500 }),
  // Mission counters for hero card UI
  missionsCompleted: integer("missions_completed").notNull().default(0),
  missionsFailed: integer("missions_failed").notNull().default(0),
});

export type Hero = typeof heroes.$inferSelect;
export type NewHero = typeof heroes.$inferInsert;

// Incidents

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: varchar("description", { length: 1000 }).notNull(),
  // slotCount + dangerLevel shown to player; requiredStats hidden until post-mission eval
  requiredStats: jsonb("required_stats").notNull(), // Partial<Record<Stat, number>>
  slotCount: integer("slot_count").notNull(), // 1–4, shown in incident modal
  dangerLevel: integer("danger_level").notNull(), // 1–3: 1=minor(green) 2=standard(yellow) 3=major(red)
  // Timing (seconds)
  missionDuration: integer("mission_duration").notNull(),
  expiryDuration: integer("expiry_duration").notNull(),
  // Interrupt
  hasInterrupt: boolean("has_interrupt").notNull().default(false),
  interruptOptions: jsonb("interrupt_options"), // InterruptOption[] | null
  topHeroId: uuid("top_hero_id"),
  // Lifecycle
  status: incidentStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;

// Missions

export const missions = pgTable("missions", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id")
    .notNull()
    .references(() => incidents.id),
  outcome: missionOutcomeEnum("outcome"),
  report: varchar("report", { length: 3000 }),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type Mission = typeof missions.$inferSelect;
export type NewMission = typeof missions.$inferInsert;

// Junction table — which heroes were on which mission (indexed, queryable)
export const missionHeroes = pgTable(
  "mission_heroes",
  {
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id),
    heroId: uuid("hero_id")
      .notNull()
      .references(() => heroes.id),
  },
  (t) => [primaryKey({ columns: [t.missionId, t.heroId] })],
);

export type MissionHero = typeof missionHeroes.$inferSelect;

// Dispatch Recommendations (hidden until after player dispatches)

export const dispatchRecommendations = pgTable("dispatch_recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id")
    .notNull()
    .references(() => incidents.id),
  recommendedHeroIds: jsonb("recommended_hero_ids").notNull(), // string[]
  reasoning: varchar("reasoning", { length: 2000 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DispatchRecommendation =
  typeof dispatchRecommendations.$inferSelect;
