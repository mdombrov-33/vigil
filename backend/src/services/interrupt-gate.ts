// In-memory gate — one pending interrupt per mission.
// Pipeline awaits waitForChoice(); player's POST resolves it.
// If the player doesn't choose in time, resolves with null → auto-fail.

const pending = new Map<string, (choiceId: string | null) => void>();

export function waitForChoice(
  missionId: string,
  timeoutMs: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(missionId);
      console.log(`[interrupt-gate] mission ${missionId} timed out — auto-fail`);
      resolve(null);
    }, timeoutMs);

    pending.set(missionId, (choiceId) => {
      clearTimeout(timer);
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
