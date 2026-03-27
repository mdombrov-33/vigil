import { db, heroes, missions, missionHeroes, incidents } from "@vigil/db";
import { and, eq, ne, desc } from "drizzle-orm";

export async function getAvailableHeroes() {
  return db
    .select()
    .from(heroes)
    .where(and(eq(heroes.availability, "available"), ne(heroes.health, "down")));
}

export async function getHeroProfile(heroId: string) {
  const result = await db
    .select()
    .from(heroes)
    .where(eq(heroes.id, heroId))
    .limit(1);
  return result[0] ?? null;
}

export async function getHeroMissionHistory(heroId: string) {
  return db
    .select({
      missionId: missions.id,
      outcome: missions.outcome,
      report: missions.report,
      startedAt: missions.startedAt,
      completedAt: missions.completedAt,
      incidentTitle: incidents.title,
      incidentDescription: incidents.description,
    })
    .from(missions)
    .innerJoin(missionHeroes, eq(missions.id, missionHeroes.missionId))
    .innerJoin(incidents, eq(missions.incidentId, incidents.id))
    .where(eq(missionHeroes.heroId, heroId))
    .orderBy(desc(missions.startedAt))
    .limit(5);
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
