import { afterEach, describe, expect, it, vi } from "vitest";
import {
  combineStats,
  getInterruptOutcome,
  getMissionOutcome,
  scoreHeroes,
  type InterruptOption,
} from "@/services/outcome.js";
import type { Hero } from "@/db/index.js";
import type { RequiredStats, StatMap } from "@/types";

// Minimal Hero for the stat math — the formulas only read the five stat
// fields (+ id for hero-specific interrupts). Everything else is irrelevant.
function makeHero(
  stats: Partial<StatMap> & { id?: string } = {},
): Hero {
  return {
    id: stats.id ?? "h1",
    threat: stats.threat ?? 0,
    grit: stats.grit ?? 0,
    presence: stats.presence ?? 0,
    edge: stats.edge ?? 0,
    tempo: stats.tempo ?? 0,
  } as unknown as Hero;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("combineStats", () => {
  it("sums each stat across the dispatched heroes", () => {
    const combined = combineStats([
      makeHero({ threat: 3, grit: 1, presence: 2, edge: 0, tempo: 4 }),
      makeHero({ threat: 2, grit: 5, presence: 1, edge: 6, tempo: 1 }),
    ]);
    expect(combined).toEqual({
      threat: 5,
      grit: 6,
      presence: 3,
      edge: 6,
      tempo: 5,
    });
  });

  it("returns all-zero for an empty dispatch", () => {
    expect(combineStats([])).toEqual({
      threat: 0,
      grit: 0,
      presence: 0,
      edge: 0,
      tempo: 0,
    });
  });
});

describe("getMissionOutcome", () => {
  const required: RequiredStats = { threat: 10, grit: 10 };

  it("succeeds when full coverage drives successChance to 1.0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const heroes = [makeHero({ threat: 10, grit: 10 })];
    expect(getMissionOutcome(heroes, required).outcome).toBe("success");
  });

  it("applies a quadratic success curve (coverage 0.5 → chance 0.25)", () => {
    // combined threat/grit = 5 each vs required 10 → coverage 0.5 → chance 0.25
    const heroes = [makeHero({ threat: 5, grit: 5 })];

    vi.spyOn(Math, "random").mockReturnValue(0.24);
    expect(getMissionOutcome(heroes, required).outcome).toBe("success");

    vi.spyOn(Math, "random").mockReturnValue(0.26);
    expect(getMissionOutcome(heroes, required).outcome).toBe("failure");
  });

  it("caps per-stat coverage at 1.0 — overkill on one stat can't cover a gap on another", () => {
    // threat hugely over-provisioned, grit at half → perStat [1.0, 0.5]
    // coverage 0.75 → chance 0.5625
    const heroes = [makeHero({ threat: 999, grit: 5 })];

    vi.spyOn(Math, "random").mockReturnValue(0.55);
    expect(getMissionOutcome(heroes, required).outcome).toBe("success");

    vi.spyOn(Math, "random").mockReturnValue(0.57);
    expect(getMissionOutcome(heroes, required).outcome).toBe("failure");
  });

  it("only scores the required stats — unrelated low stats don't drag coverage down", () => {
    // Required is threat-only; hero is strong on threat, zero elsewhere.
    // This is the "1–3 relevant stats" invariant: padding is intentionally ignored.
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const heroes = [makeHero({ threat: 10 })];
    expect(getMissionOutcome(heroes, { threat: 10 }).outcome).toBe("success");
  });

  it("returns the raw roll and the combined dispatched stats", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.42);
    const heroes = [makeHero({ threat: 4, grit: 6 })];
    const result = getMissionOutcome(heroes, required);
    expect(result.roll).toBe(0.42);
    expect(result.dispatchedStats).toEqual(combineStats(heroes));
  });
});

describe("getInterruptOutcome", () => {
  it("hero-specific: succeeds only when topHeroId is on the dispatch", () => {
    const option: InterruptOption = { id: "o1", text: "x", isHeroSpecific: true };
    const heroes = [makeHero({ id: "a" }), makeHero({ id: "b" })];

    expect(getInterruptOutcome(option, heroes, "b")).toBe("success");
    expect(getInterruptOutcome(option, heroes, "c")).toBe("failure");
  });

  it("stat check: deterministic >= comparison on the combined stat", () => {
    const option: InterruptOption = {
      id: "o1",
      text: "x",
      isHeroSpecific: false,
      requiredStat: "edge",
      requiredValue: 7,
    };
    expect(getInterruptOutcome(option, [makeHero({ edge: 7 })], null)).toBe("success");
    expect(getInterruptOutcome(option, [makeHero({ edge: 6 })], null)).toBe("failure");
  });
});

describe("scoreHeroes", () => {
  const required: RequiredStats = { threat: 10, grit: 10 };

  it("returns the top slotCount heroes ranked by coverage", () => {
    const balanced = makeHero({ id: "balanced", threat: 10, grit: 10 }); // coverage 1.0
    const partial = makeHero({ id: "partial", threat: 10, grit: 5 }); // coverage 0.75
    const weak = makeHero({ id: "weak", threat: 2, grit: 2 }); // coverage 0.2

    const picked = scoreHeroes([weak, balanced, partial], required, 2);
    expect(picked.map((h) => h.id)).toEqual(["balanced", "partial"]);
  });

  it("ranks a balanced hero above a one-stat specialist (per-stat cap)", () => {
    const specialist = makeHero({ id: "spec", threat: 999, grit: 0 }); // [1.0, 0] → 0.5
    const balanced = makeHero({ id: "bal", threat: 10, grit: 10 }); // [1.0, 1.0] → 1.0

    const picked = scoreHeroes([specialist, balanced], required, 1);
    expect(picked.map((h) => h.id)).toEqual(["bal"]);
  });
});
