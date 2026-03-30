export type HeroAvailability = "available" | "on_mission" | "resting";
export type HeroHealth = "healthy" | "injured" | "down";
export type IncidentStatus =
  | "pending"
  | "en_route"
  | "active"
  | "debriefing"
  | "completed"
  | "expired";
export type DangerLevel = 1 | 2 | 3;
export type MissionOutcome = "success" | "failure";
export type EvalVerdict = "optimal" | "good" | "suboptimal" | "poor";

export interface Hero {
  id: string;
  name: string;
  alias: string;
  threat: number;
  grit: number;
  presence: number;
  edge: number;
  tempo: number;
  bio: string;
  portraitUrl: string | null;
  injuredPortraitUrl: string | null;
  availability: HeroAvailability;
  health: HeroHealth;
  cooldownUntil: string | null;
  missionsCompleted: number;
  missionsFailed: number;
}

export interface InterruptOption {
  id: string;
  text: string;
  isHeroSpecific: boolean;
  statKey?: string;
  requiredValue?: number;
}

export interface Incident {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  dangerLevel: DangerLevel;
  slotCount: number;
  hasInterrupt: boolean;
  status: IncidentStatus;
  createdAt: string;
  expiresAt: string;
  topHeroId?: string | null;
}

export interface Session {
  id: string;
  cityHealth: number;
  score: number;
  createdAt: string;
}

// SSE event payloads
export interface SSEIncidentNew {
  incidentId: string;
  title: string;
  description: string;
  slotCount: number;
  dangerLevel: DangerLevel;
  hasInterrupt: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface SSEMissionInterrupt {
  incidentId: string;
  missionId: string;
  topHeroId: string | null;
  heroIds: string[];
  options: InterruptOption[];
}

export interface SSEMissionInterruptResolved {
  incidentId: string;
  missionId: string;
  chosenOptionId: string;
  options: InterruptOption[];
}

export interface SSEMissionOutcome {
  incidentId: string;
  missionId: string;
  outcome: MissionOutcome;
  title: string;
  heroes: { heroId: string; alias: string }[];
  evalScore: number | null;
  evalVerdict: EvalVerdict | null;
  evalPostOpNote: string | null;
}

export interface SSEHeroStateUpdate {
  heroId: string;
  alias: string;
  availability: HeroAvailability;
  health: HeroHealth;
  cooldownUntil: string | null;
}

export interface SSESessionUpdate {
  cityHealth: number;
  score: number;
}

export interface SSEGameOver {
  finalScore: number;
}
