import { create } from "zustand";
import type {
  Incident,
  HeroAvailability,
  HeroHealth,
  EvalVerdict,
  InterruptOption,
  DangerLevel,
} from "@/types/api";

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
  options: InterruptOption[];
  resolved?: {
    chosenOptionId: string;
    options: InterruptOption[];
  };
}

export interface MissionOutcomeState {
  incidentId: string;
  missionId: string;
  title: string;
  outcome: "success" | "failure";
  heroes: { heroId: string; alias: string }[];
  evalScore: number | null;
  evalVerdict: EvalVerdict | null;
  evalPostOpNote: string | null;
}

interface GameStore {
  sessionId: string | null;
  cityHealth: number;
  score: number;
  incidents: Incident[];
  logEntries: LogEntry[];
  heroStates: Record<string, HeroState>;
  interruptState: InterruptState | null;
  missionOutcomes: Record<number, MissionOutcomeState>;
  uiPaused: boolean;
  pausedDuration: number;   // total ms spent paused (accumulated)
  pausedSince: number | null; // timestamp when current pause started
  gameOver: boolean;
  finalScore: number | null;

  // Actions
  setSession: (sessionId: string, cityHealth: number, score: number) => void;
  updateCityHealth: (cityHealth: number, score: number) => void;
  addIncident: (incident: Incident) => void;
  removeIncident: (incidentId: string) => void;
  updateIncidentStatus: (incidentId: string, status: Incident["status"]) => void;
  addLogEntry: (message: string, type: LogEntry["type"]) => void;
  setHeroState: (heroId: string, state: HeroState) => void;
  setMissionOutcome: (incidentId: string, state: MissionOutcomeState) => void;
  setUiPaused: (v: boolean) => void;
  setInterrupt: (state: InterruptState) => void;
  setInterruptResolved: (resolved: { chosenOptionId: string; options: InterruptOption[] }) => void;
  clearInterrupt: () => void;
  setGameOver: (finalScore: number) => void;
  reset: () => void;
}

let logCounter = 0;

export const useGameStore = create<GameStore>((set) => ({
  sessionId: null,
  cityHealth: 100,
  score: 0,
  incidents: [],
  logEntries: [],
  heroStates: {},
  interruptState: null,
  missionOutcomes: {},
  uiPaused: false,
  pausedDuration: 0,
  pausedSince: null,
  gameOver: false,
  finalScore: null,

  setSession: (sessionId, cityHealth, score) =>
    set({ sessionId, cityHealth, score }),

  updateCityHealth: (cityHealth, score) => set({ cityHealth, score }),

  addIncident: (incident) =>
    set((s) => ({
      incidents: [...s.incidents.filter((i) => i.id !== incident.id), incident],
    })),

  removeIncident: (incidentId) =>
    set((s) => ({
      incidents: s.incidents.filter((i) => i.id !== incidentId),
    })),

  updateIncidentStatus: (incidentId, status) =>
    set((s) => ({
      incidents: s.incidents.map((i) =>
        i.id === incidentId ? { ...i, status } : i
      ),
    })),

  addLogEntry: (message, type) =>
    set((s) => ({
      logEntries: [
        ...s.logEntries,
        {
          id: `log-${++logCounter}`,
          message,
          type,
          timestamp: Date.now(),
        },
      ].slice(-200), // cap at 200 entries
    })),

  setHeroState: (heroId, state) =>
    set((s) => ({
      heroStates: { ...s.heroStates, [heroId]: state },
    })),

  setMissionOutcome: (incidentId, state) =>
    set((s) => ({ missionOutcomes: { ...s.missionOutcomes, [incidentId]: state } })),

  setUiPaused: (v) =>
    set((s) => {
      if (v) {
        // Pausing — record when we started
        return { uiPaused: true, pausedSince: Date.now() };
      } else {
        // Resuming — accumulate the time we spent paused
        const elapsed = s.pausedSince != null ? Date.now() - s.pausedSince : 0;
        return { uiPaused: false, pausedSince: null, pausedDuration: s.pausedDuration + elapsed };
      }
    }),
  setInterrupt: (state) => set({ interruptState: state }),
  setInterruptResolved: (resolved) =>
    set((s) => ({
      interruptState: s.interruptState ? { ...s.interruptState, resolved } : null,
    })),
  clearInterrupt: () => set({ interruptState: null }),

  setGameOver: (finalScore) => set({ gameOver: true, finalScore }),

  reset: () =>
    set({
      sessionId: null,
      cityHealth: 100,
      score: 0,
      incidents: [],
      logEntries: [],
      heroStates: {},
      interruptState: null,
      missionOutcomes: {},
      uiPaused: false,
      pausedDuration: 0,
      pausedSince: null,
      gameOver: false,
      finalScore: null,
    }),
}));
