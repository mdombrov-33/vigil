import { broadcast } from "@/sse/manager";
import { getPausedSessionIds } from "@/services/game-loop.js";
import {
  getRestingHeroesReadyToRecover,
  getFrozenHeroIds,
  recoverHeroes,
} from "@/db/queries/heroes.js";

// Checks every 5s for heroes whose cooldown has expired and flips them back to available.
// Skips heroes whose session is currently paused — they stay resting until the player resumes.
// Heroes with health=down have cooldownUntil=null — excluded, stay resting permanently.
export function startHeroRecovery() {
  setInterval(async () => {
    const now = new Date();
    const ready = await getRestingHeroesReadyToRecover(now);
    if (ready.length === 0) return;

    // If any sessions are paused, exclude heroes who last played in one of those sessions
    const pausedIds = getPausedSessionIds();
    let toRecover = ready;

    if (pausedIds.length > 0) {
      const frozenRows = await getFrozenHeroIds(pausedIds);
      if (frozenRows.length > 0) {
        const frozenIds = new Set(frozenRows.map((r) => r.heroId));
        toRecover = ready.filter((h) => !frozenIds.has(h.id));
      }
    }

    if (toRecover.length === 0) return;

    await recoverHeroes(toRecover.map((h) => h.id), now);

    for (const hero of toRecover) {
      console.log(`[cooldown-resolver] ${hero.alias} → available`);
      broadcast("hero:state_update", {
        heroId: hero.id,
        alias: hero.alias,
        availability: "available",
        health: hero.health,
        cooldownUntil: null,
      });
    }
  }, 5_000);
}
