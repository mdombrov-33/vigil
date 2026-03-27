import { pgEnum } from "drizzle-orm/pg-core";

export const availabilityEnum = pgEnum("availability", [
  "available",
  "on_mission",
  "resting",
]);

export const healthEnum = pgEnum("health", ["healthy", "injured", "down"]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "pending",
  "en_route",
  "active",
  "completed",
  "expired",
]);

export const missionOutcomeEnum = pgEnum("mission_outcome", [
  "success",
  "failure",
]);

export const evalVerdictEnum = pgEnum("eval_verdict", [
  "optimal",
  "good",
  "suboptimal",
  "poor",
]);
