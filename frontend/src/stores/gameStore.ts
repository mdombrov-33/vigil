import { create } from "zustand";
import type { Incident, InterruptOption } from "@/types/api";
import type { LogEntry, HeroState, InterruptState, MissionOutcomeState } from "@/types/game";
import { cityLocations } from "@/config/cityLocations";
import { SHIFT_CAP } from "@/config/shift";

export type { LogEntry, HeroState, InterruptState, MissionOutcomeState };

interface GameStore {
  sessionId: string | null;
  cityHealth: number;
  score: number;
  incidents: Incident[];
  logEntries: LogEntry[];
  heroStates: Record<string, HeroState>;
  interruptState: InterruptState | null;
  interruptQueue: InterruptState[];
  missionOutcomes: Record<string, MissionOutcomeState>;
  incidentSlots: Record<string, number>;   // incidentId → cityLocations slot id
  incidentHeroes: Record<string, string[]>; // incidentId → heroIds
  uiPaused: boolean;
  pausedAt: number | null; // wall-clock ms when pause started — used as frozen clock reference
  gameOver: boolean;
  sessionComplete: boolean;
  finalScore: number | null;
  shiftHeroIds: string[];
  setShiftHeroIds: (ids: string[]) => void;

  // Actions
  setSession: (sessionId: string, cityHealth: number, score: number) => void;
  updateCityHealth: (cityHealth: number, score: number) => void;
  addIncident: (incident: Incident) => void;
  removeIncident: (incidentId: string) => void;
  updateIncidentStatus: (incidentId: string, status: Incident["status"]) => void;
  updateIncidentExpiry: (incidentId: string, expiresAt: string) => void;
  addLogEntry: (message: string, type: LogEntry["type"]) => void;
  setHeroState: (heroId: string, state: HeroState) => void;
  setMissionOutcome: (incidentId: string, state: MissionOutcomeState) => void;
  // Called when player clicks ROLL and /roll API returns outcome data.
  // Marks rollRevealed, stores outcome+animation data, flushes log entry.
  setOutcomeRevealed: (
    incidentId: string,
    outcome: "success" | "failure",
    roll: number,
    requiredStats: Record<string, number>,
    dispatchedStats: Record<string, number> | null,
  ) => void;
  setIncidentHeroes: (incidentId: string, heroIds: string[]) => void;
  setUiPaused: (v: boolean) => void;
  clearPausedAt: () => void; // unfreeze visual timers — called by SSE or fallback timeout
  setInterrupt: (state: InterruptState) => void;
  setInterruptResolved: (resolved: { chosenOptionId: string; outcome: "success" | "failure"; combinedValue: number | null; options: InterruptOption[] }) => void;
  clearInterrupt: () => void;
  setGameOver: (finalScore: number) => void;
  setSessionComplete: (finalScore: number) => void;
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
  interruptQueue: [],
  missionOutcomes: {},
  incidentSlots: {},
  incidentHeroes: {},
  uiPaused: false,
  pausedAt: null,
  gameOver: false,
  sessionComplete: false,
  finalScore: null,
  shiftHeroIds: [],

  setShiftHeroIds: (ids) => set({ shiftHeroIds: ids.slice(0, SHIFT_CAP) }),

  setSession: (sessionId, cityHealth, score) =>
    set({ sessionId, cityHealth, score }),

  updateCityHealth: (cityHealth, score) => set({ cityHealth, score }),

  addIncident: (incident) =>
    set((s) => {
      const alreadySlotted = s.incidentSlots[incident.id] != null;
      const usedSlotIds = new Set(Object.values(s.incidentSlots));
      const slot = alreadySlotted ? null : cityLocations.find((l) => !usedSlotIds.has(l.id));
      return {
        incidents: [...s.incidents.filter((i) => i.id !== incident.id), incident],
        incidentSlots: slot
          ? { ...s.incidentSlots, [incident.id]: slot.id }
          : s.incidentSlots,
      };
    }),

  removeIncident: (incidentId) =>
    set((s) => {
      const { [incidentId]: _slot, ...slots } = s.incidentSlots;
      const { [incidentId]: _heroes, ...heroes } = s.incidentHeroes;
      return {
        incidents: s.incidents.filter((i) => i.id !== incidentId),
        incidentSlots: slots,
        incidentHeroes: heroes,
      };
    }),

  setIncidentHeroes: (incidentId, heroIds) =>
    set((s) => ({ incidentHeroes: { ...s.incidentHeroes, [incidentId]: heroIds } })),

  updateIncidentStatus: (incidentId, status) =>
    set((s) => ({
      incidents: s.incidents.map((i) =>
        i.id === incidentId ? { ...i, status } : i
      ),
    })),

  updateIncidentExpiry: (incidentId, expiresAt) =>
    set((s) => ({
      incidents: s.incidents.map((i) =>
        i.id === incidentId ? { ...i, expiresAt } : i
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

  setOutcomeRevealed: (incidentId, outcome, roll, requiredStats, dispatchedStats) =>
    set((s) => {
      const existing = s.missionOutcomes[incidentId];
      if (!existing) return s;

      // Flush outcome log now that the player has seen the roll
      const outcomeType = outcome === "success" ? "success" : "failure";
      const title = existing.title ? `[${existing.title}] ` : "";
      const heroNames = existing.heroes?.map((h: { alias: string }) => h.alias).join(", ") ?? "";
      const logMsg = `${title}${outcome.toUpperCase()}${existing.evalScore != null ? ` — ${existing.evalScore}/10 ${existing.evalVerdict?.toUpperCase()}` : ""}${heroNames ? ` (${heroNames})` : ""}`;
      const newLog: LogEntry = { id: `log-${++logCounter}`, message: logMsg, type: outcomeType, timestamp: Date.now() };
      const entries: LogEntry[] = [newLog];
      if (existing.evalPostOpNote) {
        entries.push({ id: `log-${++logCounter}`, message: `↳ ${existing.evalPostOpNote}`, type: "eval", timestamp: Date.now() });
      }

      return {
        missionOutcomes: {
          ...s.missionOutcomes,
          [incidentId]: {
            ...existing,
            outcome,
            roll,
            requiredStats,
            dispatchedStats: dispatchedStats ?? {},
            rollRevealed: true,
          },
        },
        logEntries: [...s.logEntries, ...entries],
      };
    }),

  setUiPaused: (v) => set(v ? { uiPaused: true, pausedAt: Date.now() } : { uiPaused: false }),
  clearPausedAt: () => set({ pausedAt: null }),
  setInterrupt: (state) =>
    set((s) => {
      // If there's already an active unresolved interrupt, queue the new one
      if (s.interruptState && !s.interruptState.resolved) {
        return { interruptQueue: [...s.interruptQueue, state] };
      }
      return { interruptState: state };
    }),
  setInterruptResolved: (resolved) =>
    set((s) => ({
      interruptState: s.interruptState ? { ...s.interruptState, resolved } : null,
    })),
  clearInterrupt: () =>
    set((s) => {
      const [next, ...rest] = s.interruptQueue;
      return {
        interruptState: next ?? null,
        interruptQueue: rest,
      };
    }),

  setGameOver: (finalScore) => set({ gameOver: true, finalScore }),
  setSessionComplete: (finalScore) => set({ sessionComplete: true, finalScore }),

  reset: () =>
    set({
      sessionId: null,
      cityHealth: 100,
      score: 0,
      incidents: [],
      logEntries: [],
      heroStates: {},
      interruptState: null,
      interruptQueue: [],
      missionOutcomes: {},
      incidentSlots: {},
      incidentHeroes: {},
      uiPaused: false,
      pausedAt: null,
      gameOver: false,
      sessionComplete: false,
      finalScore: null,
    }),
}));
