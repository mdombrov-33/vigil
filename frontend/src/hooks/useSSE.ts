"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGameStore } from "@/stores/gameStore";
import type {
  SSEIncidentNew,
  SSEIncidentTimerExtended,
  SSEMissionInterrupt,
  SSEMissionInterruptResolved,
  SSEMissionOutcome,
  SSEHeroStateUpdate,
  SSESessionUpdate,
  SSEGameOver,
  Incident,
} from "@/types/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function useSSE(sessionId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!sessionId) return;

    console.log("[SSE] connecting for session", sessionId);
    const es = new EventSource(`${API}/api/v1/sse?sessionId=${sessionId}`);

    es.onopen = () => console.log("[SSE] connected");
    es.onerror = (e) => console.error("[SSE] error", e);

    es.addEventListener("log", (e) => {
      const data = JSON.parse(e.data) as { message: string };
      useGameStore.getState().addLogEntry(data.message, "neutral");
    });

    es.addEventListener("incident:new", (e) => {
      const data = JSON.parse(e.data) as SSEIncidentNew;
      const incident: Incident = {
        id: data.incidentId,
        sessionId,
        title: data.title,
        description: data.description,
        hints: data.hints ?? [],
        dangerLevel: data.dangerLevel,
        slotCount: data.slotCount,
        hasInterrupt: data.hasInterrupt,
        status: "pending",
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        topHeroId: null,
      };
      useGameStore.getState().addIncident(incident);
      useGameStore.getState().addLogEntry(`Incident: ${data.title}`, "system");
    });

    es.addEventListener("incident:expired", (e) => {
      const data = JSON.parse(e.data) as { incidentId: string };
      const store = useGameStore.getState();
      store.updateIncidentStatus(data.incidentId, "expired");
      store.removeIncident(data.incidentId);
      store.addLogEntry("Incident expired — city health -15", "failure");
    });

    es.addEventListener("incident:timer_extended", (e) => {
      const data = JSON.parse(e.data) as SSEIncidentTimerExtended;
      useGameStore.getState().updateIncidentExpiry(data.incidentId, data.expiresAt);
    });

    es.addEventListener("incident:active", (e) => {
      const data = JSON.parse(e.data) as { incidentId: string };
      useGameStore.getState().updateIncidentStatus(data.incidentId, "active");
    });

    es.addEventListener("mission:interrupt", (e) => {
      const data = JSON.parse(e.data) as SSEMissionInterrupt;
      useGameStore.getState().setInterrupt({
        incidentId: data.incidentId,
        missionId: data.missionId,
        topHeroId: data.topHeroId,
        heroIds: data.heroIds ?? [],
        trigger: data.trigger ?? null,
        options: data.options,
      });
      useGameStore.getState().updateIncidentStatus(data.incidentId, "active");
    });

    es.addEventListener("mission:interrupt:resolved", (e) => {
      const data = JSON.parse(e.data) as SSEMissionInterruptResolved;
      useGameStore.getState().setInterruptResolved({
        chosenOptionId: data.chosenOptionId,
        outcome: data.outcome,
        combinedValue: data.combinedValue,
        options: data.options,
      });
    });

    es.addEventListener("mission:outcome", (e) => {
      const data = JSON.parse(e.data) as SSEMissionOutcome;
      const store = useGameStore.getState();
      // If an interrupt was pending for this incident, clear it now
      if (store.interruptState?.incidentId === data.incidentId) {
        store.clearInterrupt();
      }
      store.updateIncidentStatus(data.incidentId, "debriefing");
      queryClient.invalidateQueries({ queryKey: ["heroes"] });
      store.setMissionOutcome(data.incidentId, {
        incidentId: data.incidentId,
        missionId: data.missionId,
        title: data.title,
        outcome: data.outcome,
        heroes: data.heroes,
        evalScore: data.evalScore,
        evalVerdict: data.evalVerdict,
        evalPostOpNote: data.evalPostOpNote,
      });
      const outcomeType = data.outcome === "success" ? "success" : "failure";
      const title = data.title ? `[${data.title}] ` : "";
      const heroNames = data.heroes?.map((h) => h.alias).join(", ") ?? "";
      store.addLogEntry(
        `${title}${data.outcome.toUpperCase()}${data.evalScore != null ? ` — ${data.evalScore}/10 ${data.evalVerdict?.toUpperCase()}` : ""}${heroNames ? ` (${heroNames})` : ""}`,
        outcomeType
      );
      if (data.evalPostOpNote) {
        store.addLogEntry(`↳ ${data.evalPostOpNote}`, "eval");
      }
    });

    es.addEventListener("hero:state_update", (e) => {
      const data = JSON.parse(e.data) as SSEHeroStateUpdate;
      useGameStore.getState().setHeroState(data.heroId, {
        availability: data.availability,
        health: data.health,
        cooldownUntil: data.cooldownUntil,
      });
    });

    es.addEventListener("session:update", (e) => {
      const data = JSON.parse(e.data) as SSESessionUpdate;
      useGameStore.getState().updateCityHealth(data.cityHealth, data.score);
    });

    es.addEventListener("game:over", (e) => {
      const data = JSON.parse(e.data) as SSEGameOver;
      useGameStore.getState().setGameOver(data.finalScore);
    });

    return () => {
      console.log("[SSE] closing");
      es.close();
    };
  }, [sessionId]);
}
