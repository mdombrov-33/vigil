import { db, heroes, incidents, missions, missionHeroes } from "@/db/index.js";
import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import type { NewIncident } from "@/db/schema.js";

export async function getActiveSessionIncidents(sessionId: string) {
  return db
    .select()
    .from(incidents)
    .where(and(
      eq(incidents.sessionId, sessionId),
      inArray(incidents.status, ["pending", "en_route", "active", "debriefing"]),
    ));
}

export async function getIncidentById(id: string) {
  const result = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getSessionIncidentHistory(sessionId: string) {
  return db
    .select({
      id: incidents.id,
      title: incidents.title,
      status: incidents.status,
      arcId: incidents.arcId,
      missionOutcome: missions.outcome,
      evalVerdict: missions.evalVerdict,
      evalPostOpNote: missions.evalPostOpNote,
    })
    .from(incidents)
    .leftJoin(missions, eq(missions.incidentId, incidents.id))
    .where(eq(incidents.sessionId, sessionId))
    .orderBy(desc(incidents.createdAt));
}

// Returns hero reports for arc-linked incidents — used by IncidentGeneratorAgent for narrative continuity
export async function getArcIncidentHeroReports(arcIncidentIds: string[]) {
  if (arcIncidentIds.length === 0) return [];
  return db
    .select({
      incidentId: missions.incidentId,
      alias: heroes.alias,
      report: missionHeroes.report,
    })
    .from(missionHeroes)
    .innerJoin(missions, eq(missions.id, missionHeroes.missionId))
    .innerJoin(heroes, eq(heroes.id, missionHeroes.heroId))
    .where(and(
      inArray(missions.incidentId, arcIncidentIds),
      ne(missionHeroes.report, ""),
    ));
}

export async function createIncident(data: NewIncident) {
  const [incident] = await db.insert(incidents).values(data).returning();
  return incident;
}

export async function setIncidentStatus(
  id: string,
  status: "pending" | "en_route" | "active" | "debriefing" | "completed" | "expired",
) {
  await db.update(incidents).set({ status }).where(eq(incidents.id, id));
}

// Marks all non-terminal incidents for a session as expired (used on session restart)
export async function clearStaleIncidents(sessionId: string) {
  await db
    .update(incidents)
    .set({ status: "expired" })
    .where(and(
      eq(incidents.sessionId, sessionId),
      inArray(incidents.status, ["pending", "en_route", "active", "debriefing"]),
    ));
}

export async function getExpiredPendingIncidents(sessionId: string, now: Date) {
  return db
    .select()
    .from(incidents)
    .where(and(
      eq(incidents.sessionId, sessionId),
      eq(incidents.status, "pending"),
      lt(incidents.expiresAt, now),
    ));
}

export async function markIncidentsExpired(sessionId: string, now: Date) {
  await db
    .update(incidents)
    .set({ status: "expired" })
    .where(and(
      eq(incidents.sessionId, sessionId),
      eq(incidents.status, "pending"),
      lt(incidents.expiresAt, now),
    ));
}

// Returns count of pending/en_route/active incidents (used for spawn cap)
export async function getActiveIncidentCount(sessionId: string) {
  const result = await db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(
      eq(incidents.sessionId, sessionId),
      inArray(incidents.status, ["pending", "en_route", "active"]),
    ));
  return result.length;
}

// Returns incident IDs still in play (used for session completion check)
export async function getUnresolvedIncidentIds(sessionId: string) {
  return db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(
      eq(incidents.sessionId, sessionId),
      inArray(incidents.status, ["pending", "en_route", "active", "debriefing"]),
    ));
}

export async function extendIncidentTimers(sessionId: string, pausedMs: number) {
  return db
    .update(incidents)
    .set({ expiresAt: sql`${incidents.expiresAt} + make_interval(secs => ${pausedMs / 1000})` })
    .where(and(eq(incidents.sessionId, sessionId), eq(incidents.status, "pending")))
    .returning({ id: incidents.id, expiresAt: incidents.expiresAt });
}
