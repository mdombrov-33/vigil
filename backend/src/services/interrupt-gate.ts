// In-memory gate — one pending interrupt per mission.
// Pipeline awaits waitForChoice(); player's POST resolves it.
// If the player doesn't choose in time (counting only unpaused time), resolves with null → auto-fail.

import { isSessionPaused } from "@/services/game-loop.js";

const pending = new Map<string, (choiceId: string | null) => void>();

export function waitForChoice(
  missionId: string,
  sessionId: string,
  timeoutMs: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    let elapsed = 0;
    const TICK = 200;

    const timer = setInterval(() => {
      if (!isSessionPaused(sessionId)) {
        elapsed += TICK;
      }
      if (elapsed >= timeoutMs) {
        clearInterval(timer);
        pending.delete(missionId);
        console.log(`[interrupt-gate] mission ${missionId} timed out — auto-fail`);
        resolve(null);
      }
    }, TICK);

    pending.set(missionId, (choiceId) => {
      clearInterval(timer);
      resolve(choiceId);
    });
  });
}

export function resolveChoice(missionId: string, choiceId: string): boolean {
  const resolve = pending.get(missionId);
  if (!resolve) return false;
  pending.delete(missionId);
  resolve(choiceId);
  return true;
}

export function hasPendingInterrupt(missionId: string): boolean {
  return pending.has(missionId);
}
