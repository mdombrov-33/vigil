import type { Hero } from "@vigil/db";
import type { RequiredStats, Stat, StatMap } from "@/types";

export type InterruptOption = {
  id: string;
  text: string;
  isHeroSpecific: boolean;
  requiredStat?: Stat;
  requiredValue?: number;
};

export function getInterruptOutcome(
  option: InterruptOption,
  heroes: Hero[],
  topHeroId: string | null,
): "success" | "failure" {
  if (option.isHeroSpecific) {
    return heroes.some((h) => h.id === topHeroId) ? "success" : "failure";
  }
  const combined = combineStats(heroes);
  return combined[option.requiredStat!] >= option.requiredValue!
    ? "success"
    : "failure";
}

export function combineStats(heroes: Hero[]): StatMap {
  return heroes.reduce(
    (acc, hero) => ({
      threat: acc.threat + hero.threat,
      grit: acc.grit + hero.grit,
      presence: acc.presence + hero.presence,
      edge: acc.edge + hero.edge,
      tempo: acc.tempo + hero.tempo,
    }),
    { threat: 0, grit: 0, presence: 0, edge: 0, tempo: 0 },
  );
}

export function getMissionOutcome(
  heroes: Hero[],
  requiredStats: RequiredStats,
): "success" | "failure" {
  const combined = combineStats(heroes);
  const statKeys = Object.keys(requiredStats) as Stat[];

  const perStat = statKeys.map((s) =>
    Math.min(combined[s] / requiredStats[s]!, 1.0),
  );
  const coverage = perStat.reduce((a, b) => a + b, 0) / perStat.length;
  const successChance = Math.pow(coverage, 2);

  return Math.random() < successChance ? "success" : "failure";
}

// Score individual heroes against required stats — higher = better match.
// Pipeline uses this to pick the recommended team.
export function scoreHeroes(
  heroes: Hero[],
  requiredStats: RequiredStats,
  slotCount: number,
): Hero[] {
  const statKeys = Object.keys(requiredStats) as Stat[];

  const scored = heroes.map((hero) => {
    const coverage =
      statKeys.reduce((sum, s) => {
        return sum + Math.min(hero[s] / requiredStats[s]!, 1.0);
      }, 0) / statKeys.length;
    return { hero, coverage };
  });

  return scored
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, slotCount)
    .map((s) => s.hero);
}
