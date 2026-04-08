import { send } from "@/sse/manager.js";
import {
  getSessionById,
  getSessionHealthAndScore,
  updateScore,
  updateCityHealth,
  endSession,
} from "@/db/queries/sessions.js";

const VERDICT_SCORE: Record<string, number> = {
  optimal: 100,
  good: 75,
  suboptimal: 40,
  poor: 10,
};

export async function addScore(sessionId: string, verdict: string): Promise<void> {
  const points = VERDICT_SCORE[verdict] ?? 0;
  if (points === 0) return;

  await updateScore(sessionId, points);

  const session = await getSessionHealthAndScore(sessionId);
  console.log(`[score] +${points} (${verdict}) → ${session?.score}`);
  send(sessionId, "session:update", { cityHealth: session?.cityHealth ?? 100, score: session?.score ?? 0 });
}

export async function dockCityHealth(sessionId: string, amount: number, reason: string): Promise<void> {
  const session = await getSessionById(sessionId);
  if (!session) return;

  const newHealth = Math.max(0, session.cityHealth - amount);
  await updateCityHealth(sessionId, newHealth);

  const updated = await getSessionHealthAndScore(sessionId);
  console.log(`[city-health] -${amount} (${reason}) → ${newHealth}`);
  send(sessionId, "session:update", {
    cityHealth: updated?.cityHealth ?? newHealth,
    score: updated?.score ?? 0,
  });

  if (newHealth <= 0) {
    console.log(`[city-health] game over for session ${sessionId}`);
    await endSession(sessionId);
    send(sessionId, "game:over", { finalScore: session.score });
  }
}
