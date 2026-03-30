import { db, sessions } from "@/db/index.js";
import { eq, sql } from "drizzle-orm";
import { send } from "@/sse/manager.js";

const VERDICT_SCORE: Record<string, number> = {
  optimal: 100,
  good: 75,
  suboptimal: 40,
  poor: 10,
};

export async function addScore(
  sessionId: string,
  verdict: string,
): Promise<void> {
  const points = VERDICT_SCORE[verdict] ?? 0;
  if (points === 0) return;

  await db
    .update(sessions)
    .set({ score: sql`${sessions.score} + ${points}` })
    .where(eq(sessions.id, sessionId));

  const [session] = await db
    .select({ cityHealth: sessions.cityHealth, score: sessions.score })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  console.log(`[score] +${points} (${verdict}) → ${session?.score}`);
  send(sessionId, "session:update", { cityHealth: session?.cityHealth ?? 100, score: session?.score ?? 0 });
}

export async function dockCityHealth(
  sessionId: string,
  amount: number,
  reason: string,
): Promise<void> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!session) return;

  const newHealth = Math.max(0, session.cityHealth - amount);

  await db
    .update(sessions)
    .set({ cityHealth: newHealth })
    .where(eq(sessions.id, sessionId));

  const [updated] = await db
    .select({ cityHealth: sessions.cityHealth, score: sessions.score })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  console.log(`[city-health] -${amount} (${reason}) → ${newHealth}`);

  send(sessionId, "session:update", {
    cityHealth: updated?.cityHealth ?? newHealth,
    score: updated?.score ?? 0,
  });

  if (newHealth <= 0) {
    console.log(`[city-health] game over for session ${sessionId}`);
    await db
      .update(sessions)
      .set({ endedAt: new Date() })
      .where(eq(sessions.id, sessionId));
    send(sessionId, "game:over", { finalScore: session.score });
  }
}
