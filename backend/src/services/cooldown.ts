import type { Hero } from "@/db/index.js";

const COOLDOWN_RESTING_S = 30;
const COOLDOWN_INJURED_S = 90;

export function getCooldownUntil(health: Hero["health"]): Date | null {
  if (health === "down") return null; // permanent — handled manually
  const seconds = health === "injured" ? COOLDOWN_INJURED_S : COOLDOWN_RESTING_S;
  return new Date(Date.now() + seconds * 1000);
}

// After a failed mission: weighted random health outcome per hero.
export function rollHealthAfterFailure(current: Hero["health"]): Hero["health"] {
  if (current === "down") return "down";
  const roll = Math.random();
  if (current === "injured") {
    return roll < 0.6 ? "down" : "injured"; // already compromised
  }
  // currently healthy
  if (roll < 0.6) return "healthy";
  if (roll < 0.9) return "injured";
  return "down";
}
