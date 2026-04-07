"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";
import { api } from "@/api";
import { sounds } from "@/sounds";
import type { Hero, Incident } from "@/types/api";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

export function useGameModals(sessionId: string) {
  const { setUiPaused, updateIncidentStatus, setIncidentHeroes, interruptState } = useGameStore();

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>([]);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [interruptModalOpen, setInterruptModalOpen] = useState(false);
  const [debriefIncidentId, setDebriefIncidentId] = useState<string | null>(null);
  const [rollRevealIncidentId, setRollRevealIncidentId] = useState<string | null>(null);
  const [draggingHeroId, setDraggingHeroId] = useState<string | null>(null);

  // Auto-close interrupt modal when interrupt clears
  useEffect(() => {
    if (!interruptState) setInterruptModalOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interruptState?.incidentId]);

  function pauseGame() {
    setUiPaused(true);
    api.sessions.pause(sessionId);
  }

  function resumeGame() {
    setUiPaused(false);
    api.sessions.resume(sessionId).catch(() => {});
    setTimeout(() => useGameStore.getState().clearPausedAt(), 500);
  }

  function handleIncidentClick(incident: Incident) {
    const { missionOutcomes, interruptState: currentInterrupt } = useGameStore.getState();
    if (incident.status === "pending") {
      setSelectedIncident(incident);
      setSelectedHeroIds([]);
      pauseGame();
    } else if (incident.status === "active" && currentInterrupt?.incidentId === incident.id) {
      setInterruptModalOpen(true);
      pauseGame();
    } else if (incident.status === "debriefing" && missionOutcomes[incident.id]?.rollRevealed === false) {
      setRollRevealIncidentId(incident.id);
      pauseGame();
    } else if (incident.status === "debriefing") {
      setDebriefIncidentId(incident.id);
      pauseGame();
    }
  }

  function handleHeroToggle(heroId: string) {
    if (!selectedIncident) return;
    setSelectedHeroIds((prev) => {
      if (prev.includes(heroId)) return prev.filter((id) => id !== heroId);
      if (prev.length >= selectedIncident.slotCount) return prev;
      return [...prev, heroId];
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const heroId = event.active.data.current?.heroId as string | undefined;
    if (heroId != null) setDraggingHeroId(heroId);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingHeroId(null);
    const { over, active } = event;
    if (!over || !selectedIncident) return;
    if (!String(over.id).startsWith("slot-")) return;
    const heroId = active.data.current?.heroId as string | undefined;
    if (heroId == null) return;
    sounds.slotDrop();
    handleHeroToggle(heroId);
  }

  function handleDispatched() {
    if (selectedIncident) {
      updateIncidentStatus(selectedIncident.id, "en_route");
      setIncidentHeroes(selectedIncident.id, selectedHeroIds);
    }
    setSelectedIncident(null);
    setSelectedHeroIds([]);
    resumeGame();
  }

  function closeIncident() {
    setSelectedIncident(null);
    setSelectedHeroIds([]);
    resumeGame();
  }

  function openHeroDetail(hero: Hero) {
    setSelectedHero(hero);
    pauseGame();
  }

  function closeHeroDetail() {
    setSelectedHero(null);
    resumeGame();
  }

  function closeInterrupt() {
    setInterruptModalOpen(false);
    resumeGame();
  }

  function closeRollReveal() {
    setRollRevealIncidentId(null);
    resumeGame();
  }

  function closeDebrief(incidentId: string) {
    useGameStore.getState().removeIncident(incidentId);
    setDebriefIncidentId(null);
    resumeGame();
  }

  return {
    selectedIncident,
    selectedHeroIds,
    selectedHero,
    interruptModalOpen,
    setInterruptModalOpen,
    debriefIncidentId,
    rollRevealIncidentId,
    draggingHeroId,
    pauseGame,
    resumeGame,
    handleIncidentClick,
    handleHeroToggle,
    handleDragStart,
    handleDragEnd,
    handleDispatched,
    closeIncident,
    openHeroDetail,
    closeHeroDetail,
    closeInterrupt,
    closeRollReveal,
    closeDebrief,
  };
}
