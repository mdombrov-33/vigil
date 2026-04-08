import { db, heroes, missions, missionHeroes } from "@/db/index.js";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";

export async function createMission(incidentId: string) {
  const [mission] = await db.insert(missions).values({ incidentId }).returning();
  return mission;
}

export async function createMissionHeroes(missionId: string, heroIds: string[]) {
  await db.insert(missionHeroes).values(heroIds.map((heroId) => ({ missionId, heroId })));
}

export async function getActiveMission(incidentId: string) {
  const result = await db
    .select()
    .from(missions)
    .where(and(eq(missions.incidentId, incidentId), isNull(missions.completedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function getCompletedMission(incidentId: string) {
  const result = await db
    .select()
    .from(missions)
    .where(and(eq(missions.incidentId, incidentId), isNotNull(missions.completedAt)))
    .orderBy(desc(missions.completedAt))
    .limit(1);
  return result[0] ?? null;
}

export async function storeMissionRoll(
  missionId: string,
  roll: number,
  dispatchedStats: Record<string, number>,
) {
  await db
    .update(missions)
    .set({ roll, dispatchedStats })
    .where(eq(missions.id, missionId));
}

export async function completeMission(missionId: string, outcome: "success" | "failure") {
  await db
    .update(missions)
    .set({ outcome, completedAt: new Date() })
    .where(eq(missions.id, missionId));
}

export async function storeMissionEval(
  missionId: string,
  evalScore: number,
  evalVerdict: string,
  evalExplanation: string,
  evalPostOpNote: string,
) {
  await db
    .update(missions)
    .set({ evalScore, evalVerdict: evalVerdict as "optimal" | "good" | "suboptimal" | "poor", evalExplanation, evalPostOpNote })
    .where(eq(missions.id, missionId));
}

export async function saveMissionHeroReport(missionId: string, heroId: string, report: string) {
  await db
    .update(missionHeroes)
    .set({ report })
    .where(and(eq(missionHeroes.missionId, missionId), eq(missionHeroes.heroId, heroId)));
}

export async function getMissionHeroReports(missionId: string) {
  return db
    .select({
      heroId: heroes.id,
      alias: heroes.alias,
      portraitUrl: heroes.portraitUrl,
      report: missionHeroes.report,
    })
    .from(missionHeroes)
    .innerJoin(heroes, eq(missionHeroes.heroId, heroes.id))
    .where(eq(missionHeroes.missionId, missionId));
}

export async function getMissionDispatchedHeroes(missionId: string) {
  const rows = await db
    .select({ hero: heroes })
    .from(missionHeroes)
    .innerJoin(heroes, eq(missionHeroes.heroId, heroes.id))
    .where(eq(missionHeroes.missionId, missionId));
  return rows.map((r) => r.hero);
}
