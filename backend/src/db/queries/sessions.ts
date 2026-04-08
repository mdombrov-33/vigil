import { db, sessions } from "@/db/index.js";
import { eq, sql } from "drizzle-orm";

export async function createSession() {
  const [session] = await db.insert(sessions).values({}).returning();
  return session;
}

export async function getSessionById(id: string) {
  const result = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getSessionSpawnState(id: string) {
  const result = await db
    .select({
      incidentCount: sessions.incidentCount,
      incidentLimit: sessions.incidentLimit,
      score: sessions.score,
    })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function getSessionHealthAndScore(id: string) {
  const result = await db
    .select({ cityHealth: sessions.cityHealth, score: sessions.score })
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return result[0] ?? null;
}

export async function updateSessionArcs(
  id: string,
  arcSeeds: unknown,
  sessionMood: string,
  incidentLimit: number,
) {
  await db
    .update(sessions)
    .set({ arcSeeds, sessionMood, incidentLimit, incidentCount: 0 })
    .where(eq(sessions.id, id));
}

export async function incrementIncidentCount(id: string) {
  await db
    .update(sessions)
    .set({ incidentCount: sql`${sessions.incidentCount} + 1` })
    .where(eq(sessions.id, id));
}

export async function updateScore(id: string, points: number) {
  await db
    .update(sessions)
    .set({ score: sql`${sessions.score} + ${points}` })
    .where(eq(sessions.id, id));
}

export async function updateCityHealth(id: string, newHealth: number) {
  await db
    .update(sessions)
    .set({ cityHealth: newHealth })
    .where(eq(sessions.id, id));
}

export async function endSession(id: string) {
  await db.update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, id));
}
