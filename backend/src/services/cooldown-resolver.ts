import { db, heroes } from "@vigil/db";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { broadcast } from "@/sse/manager";

// Checks every 5s for heroes whose cooldown has expired and flips them back to available.
// Heroes with health=down have cooldownUntil=null — they are excluded and stay resting permanently.
export function startCooldownResolver() {
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

    await db
      .update(heroes)
      .set({ availability: "available", cooldownUntil: null })
      .where(
        and(
          eq(heroes.availability, "resting"),
          isNotNull(heroes.cooldownUntil),
          lte(heroes.cooldownUntil, now),
        ),
      );

    for (const hero of ready) {
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
