import { create } from "zustand";
import type { Incident, InterruptOption } from "@/types/api";
import type { LogEntry, HeroState, InterruptState, MissionOutcomeState } from "@/types/game";

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
  pendingSessionUpdate: { cityHealth: number; score: number } | null;
  uiPaused: boolean;
  pausedAt: number | null; // wall-clock ms when pause started — used as frozen clock reference
  gameOver: boolean;
  sessionComplete: boolean;
  finalScore: number | null;

  // Actions
  setSession: (sessionId: string, cityHealth: number, score: number) => void;
  updateCityHealth: (cityHealth: number, score: number) => void;
  applyOrDeferSessionUpdate: (cityHealth: number, score: number) => void;
  addIncident: (incident: Incident) => void;
  removeIncident: (incidentId: string) => void;
  updateIncidentStatus: (incidentId: string, status: Incident["status"]) => void;
  updateIncidentExpiry: (incidentId: string, expiresAt: string) => void;
  addLogEntry: (message: string, type: LogEntry["type"]) => void;
  setHeroState: (heroId: string, state: HeroState) => void;
  setMissionOutcome: (incidentId: string, state: MissionOutcomeState) => void;
  setRollRevealed: (incidentId: string) => void;
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
  pendingSessionUpdate: null,
  uiPaused: false,
  pausedAt: null,
  gameOver: false,
  sessionComplete: false,
  finalScore: null,

  setSession: (sessionId, cityHealth, score) =>
    set({ sessionId, cityHealth, score }),

  updateCityHealth: (cityHealth, score) => set({ cityHealth, score }),

  applyOrDeferSessionUpdate: (cityHealth, score) =>
    set((s) => {
      const hasPendingRoll = Object.values(s.missionOutcomes).some((o) => !o.rollRevealed);
      if (hasPendingRoll) return { pendingSessionUpdate: { cityHealth, score } };
      return { cityHealth, score, pendingSessionUpdate: null };
    }),

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

  setRollRevealed: (incidentId) =>
    set((s) => {
      const existing = s.missionOutcomes[incidentId];
      if (!existing) return s;

      // Flush the deferred outcome log now that the player has seen the roll
      const outcomeType = existing.outcome === "success" ? "success" : "failure";
      const title = existing.title ? `[${existing.title}] ` : "";
      const heroNames = existing.heroes?.map((h: { alias: string }) => h.alias).join(", ") ?? "";
      const logMsg = `${title}${existing.outcome.toUpperCase()}${existing.evalScore != null ? ` — ${existing.evalScore}/10 ${existing.evalVerdict?.toUpperCase()}` : ""}${heroNames ? ` (${heroNames})` : ""}`;
      const newLog: LogEntry = { id: ++logCounter, message: logMsg, type: outcomeType, timestamp: Date.now() };
      const entries: LogEntry[] = [newLog];
      if (existing.evalPostOpNote) {
        entries.push({ id: ++logCounter, message: `↳ ${existing.evalPostOpNote}`, type: "eval", timestamp: Date.now() });
      }

      const updatedOutcomes = { ...s.missionOutcomes, [incidentId]: { ...existing, rollRevealed: true } };
      const stillPending = Object.values(updatedOutcomes).some((o) => !o.rollRevealed);

      // Apply deferred session update (score/health) once no rolls remain unrevealed
      const sessionPatch = (!stillPending && s.pendingSessionUpdate)
        ? { cityHealth: s.pendingSessionUpdate.cityHealth, score: s.pendingSessionUpdate.score, pendingSessionUpdate: null }
        : {};

      return {
        missionOutcomes: updatedOutcomes,
        logEntries: [...s.logEntries, ...entries],
        ...sessionPatch,
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
      pendingSessionUpdate: null,
      uiPaused: false,
      pausedAt: null,
      gameOver: false,
      sessionComplete: false,
      finalScore: null,
    }),
}));
