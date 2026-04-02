import { db, heroes, missions, missionHeroes, incidents } from "@/db/index.js";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { broadcast } from "@/sse/manager";
import { getPausedSessionIds } from "@/services/game-loop.js";

// Checks every 5s for heroes whose cooldown has expired and flips them back to available.
// Skips heroes whose session is currently paused — they stay resting until the player resumes.
// Heroes with health=down have cooldownUntil=null — excluded, stay resting permanently.
export function startHeroRecovery() {
  setInterval(async () => {
    const now = new Date();

    const ready = await db
      .select()
      .from(heroes)
      .where(
        and(
          eq(heroes.availability, "resting"),
          isNotNull(heroes.cooldownUntil),
          lte(heroes.cooldownUntil, now),
        ),
      );

    if (ready.length === 0) return;

    // If any sessions are paused, exclude heroes who last played in one of those sessions
    const pausedIds = getPausedSessionIds();
    let toRecover = ready;

    if (pausedIds.length > 0) {
      const frozenRows = await db
        .selectDistinct({ heroId: missionHeroes.heroId })
        .from(missionHeroes)
        .innerJoin(missions, eq(missions.id, missionHeroes.missionId))
        .innerJoin(incidents, eq(incidents.id, missions.incidentId))
        .where(inArray(incidents.sessionId, pausedIds));

      if (frozenRows.length > 0) {
        const frozenIds = new Set(frozenRows.map((r) => r.heroId));
        toRecover = ready.filter((h) => !frozenIds.has(h.id));
      }
    }

    if (toRecover.length === 0) return;

    await db
      .update(heroes)
      .set({ availability: "available", cooldownUntil: null })
      .where(
        and(
          eq(heroes.availability, "resting"),
          isNotNull(heroes.cooldownUntil),
          lte(heroes.cooldownUntil, now),
          inArray(heroes.id, toRecover.map((h) => h.id)),
        ),
      );

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
