import type { EvalVerdict, InterruptOption, HeroAvailability, HeroHealth } from "@/types/api";

export interface LogEntry {
  id: string;
  message: string;
  type: "neutral" | "success" | "failure" | "eval" | "system";
  timestamp: number;
}

export interface HeroState {
  availability: HeroAvailability;
  health: HeroHealth;
  cooldownUntil: string | null;
}

export interface InterruptState {
  incidentId: string;
  missionId: string;
  topHeroId: string | null;
  heroIds: string[];
  trigger: string | null;
  interruptCreatedAt: string;
  interruptDurationMs: number;
  options: InterruptOption[];
  resolved?: {
    chosenOptionId: string;
    outcome: "success" | "failure";
    combinedValue: number | null;
    options: InterruptOption[];
  };
}

export interface MissionOutcomeState {
  incidentId: string;
  missionId: string;
  title: string;
  // null for non-interrupt missions until player clicks ROLL and calls /roll endpoint.
  outcome: "success" | "failure" | null;
  heroes: { heroId: string; alias: string }[];
  evalScore: number | null;
  evalVerdict: EvalVerdict | null;
  evalPostOpNote: string | null;
  rollRevealed: boolean;
  requiredStats: Record<string, number>;
  dispatchedStats: Record<string, number>;
  roll: number | null;
}
