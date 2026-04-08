import { db, heroes, missions, missionHeroes, incidents } from "@/db/index.js";
import { and, desc, eq, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";

export async function getAllHeroes() {
  return db.select().from(heroes);
}

export async function getHeroBios() {
  return db.select({ alias: heroes.alias, bio: heroes.bio }).from(heroes);
}

export async function getAvailableHeroes() {
  return db
    .select()
    .from(heroes)
    .where(and(eq(heroes.availability, "available"), ne(heroes.health, "down")));
}

export async function getAllNonDownHeroes() {
  return db.select().from(heroes).where(ne(heroes.health, "down"));
}

export async function getHeroesByIds(heroIds: string[]) {
  return db.select().from(heroes).where(inArray(heroes.id, heroIds));
}

export async function getAvailableHeroesByIds(heroIds: string[]) {
  return db
    .select()
    .from(heroes)
    .where(and(
      inArray(heroes.id, heroIds),
      eq(heroes.availability, "available"),
      ne(heroes.health, "down"),
    ));
}

export async function getHeroById(heroId: string) {
  const result = await db.select().from(heroes).where(eq(heroes.id, heroId)).limit(1);
  return result[0] ?? null;
}

export async function getHeroMissionHistory(heroId: string, sessionId: string) {
  return db
    .select({
      missionId: missions.id,
      outcome: missions.outcome,
      report: missionHeroes.report,
      startedAt: missions.startedAt,
      completedAt: missions.completedAt,
      incidentTitle: incidents.title,
      incidentDescription: incidents.description,
    })
    .from(missions)
    .innerJoin(missionHeroes, eq(missions.id, missionHeroes.missionId))
    .innerJoin(incidents, eq(missions.incidentId, incidents.id))
    .where(and(eq(missionHeroes.heroId, heroId), eq(incidents.sessionId, sessionId)))
    .orderBy(desc(missions.startedAt))
    .limit(5);
}

export async function setHeroesOnMission(heroIds: string[]) {
  await db
    .update(heroes)
    .set({ availability: "on_mission" })
    .where(inArray(heroes.id, heroIds));
}

export async function setHeroResting(
  heroId: string,
  health: "healthy" | "injured" | "down",
  cooldownUntil: Date | null,
) {
  await db
    .update(heroes)
    .set({ availability: "resting", health, cooldownUntil })
    .where(eq(heroes.id, heroId));
}

export async function updateHeroState(
  heroId: string,
  availability: "available" | "on_mission" | "resting",
  health: "healthy" | "injured" | "down",
  cooldownUntil: Date | null,
) {
  await db
    .update(heroes)
    .set({ availability, health, cooldownUntil })
    .where(eq(heroes.id, heroId));
}

export async function resetAllHeroes() {
  await db.update(heroes).set({
    availability: "available",
    health: "healthy",
    cooldownUntil: null,
    missionsCompleted: 0,
    missionsFailed: 0,
  });
}

export async function extendHeroCooldowns(heroIds: string[], pausedMs: number) {
  return db
    .update(heroes)
    .set({ cooldownUntil: sql`${heroes.cooldownUntil} + make_interval(secs => ${pausedMs / 1000})` })
    .where(and(
      eq(heroes.availability, "resting"),
      isNotNull(heroes.cooldownUntil),
      inArray(heroes.id, heroIds),
    ))
    .returning();
}

export async function recoverHeroes(heroIds: string[], now: Date) {
  await db
    .update(heroes)
    .set({ availability: "available", cooldownUntil: null })
    .where(and(
      eq(heroes.availability, "resting"),
      isNotNull(heroes.cooldownUntil),
      lte(heroes.cooldownUntil, now),
      inArray(heroes.id, heroIds),
    ));
}

export async function getRestingHeroesReadyToRecover(now: Date) {
  return db
    .select()
    .from(heroes)
    .where(and(
      eq(heroes.availability, "resting"),
      isNotNull(heroes.cooldownUntil),
      lte(heroes.cooldownUntil, now),
    ));
}

export async function getSessionHeroIds(sessionId: string) {
  return db
    .selectDistinct({ heroId: missionHeroes.heroId })
    .from(missionHeroes)
    .innerJoin(missions, eq(missions.id, missionHeroes.missionId))
    .innerJoin(incidents, eq(incidents.id, missions.incidentId))
    .where(eq(incidents.sessionId, sessionId));
}

export async function getFrozenHeroIds(pausedSessionIds: string[]) {
  return db
    .selectDistinct({ heroId: missionHeroes.heroId })
    .from(missionHeroes)
    .innerJoin(missions, eq(missions.id, missionHeroes.missionId))
    .innerJoin(incidents, eq(incidents.id, missions.incidentId))
    .where(inArray(incidents.sessionId, pausedSessionIds));
}

export async function incrementMissionCounters(heroIds: string[], outcome: "success" | "failure") {
  await db
    .update(heroes)
    .set({
      missionsCompleted: outcome === "success"
        ? sql`${heroes.missionsCompleted} + 1`
        : heroes.missionsCompleted,
      missionsFailed: outcome === "failure"
        ? sql`${heroes.missionsFailed} + 1`
        : heroes.missionsFailed,
    })
    .where(inArray(heroes.id, heroIds));
}
