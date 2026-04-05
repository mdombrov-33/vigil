"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { api } from "@/api";
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useGameStore } from "@/stores/gameStore";
import { useHeroes } from "@/hooks/useHeroes";
import { useSSE } from "@/hooks/useSSE";
import { sounds } from "@/sounds";
import { GameLayout } from "@/components/game/GameLayout";
import { ShiftEndScreen } from "@/components/game/ShiftEndScreen";
import { HeroDetailModal } from "@/components/modals/HeroDetailModal";
import { InterruptModal } from "@/components/modals/InterruptModal";
import { DebriefModal } from "@/components/modals/DebriefModal";
import { RollRevealModal } from "@/components/modals/RollRevealModal";
import type { Hero, Incident } from "@/types/api";

export default function ActiveShiftPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const queryClient = useQueryClient();

  const { setSession, reset, updateIncidentStatus, removeIncident, interruptState, missionOutcomes, setUiPaused, setIncidentHeroes, sessionComplete, gameOver, score, cityHealth } = useGameStore();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>([]);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [interruptModalOpen, setInterruptModalOpen] = useState(false);
  const [debriefIncidentId, setDebriefIncidentId] = useState<string | null>(null);
  const [rollRevealIncidentId, setRollRevealIncidentId] = useState<string | null>(null);
  const [draggingHeroId, setDraggingHeroId] = useState<string | null>(null);
  const { data: heroes = [] } = useHeroes();
  const { data: sessionData } = useSession(sessionId);

  useSSE(sessionId);

  // Reset store on mount
  useEffect(() => {
    reset();
    setSession(sessionId, 100, 0);
    queryClient.invalidateQueries({ queryKey: ["heroes"] });
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate city health + score from server once session data arrives
  useEffect(() => {
    if (sessionData) {
      setSession(sessionId, sessionData.cityHealth, sessionData.score);
    }
  }, [sessionData?.cityHealth, sessionData?.score]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide cursor while dragging
  useEffect(() => {
    document.body.style.cursor = draggingHeroId != null ? "none" : "";
    return () => { document.body.style.cursor = ""; };
  }, [draggingHeroId]);

  // Preload portraits for instant DragOverlay
  useEffect(() => {
    heroes.forEach((h) => { if (h.portraitUrl) new Image().src = h.portraitUrl; });
  }, [heroes]);

  // Auto-open when a new interrupt arrives; auto-close when cleared
  useEffect(() => {
    if (interruptState && !interruptState.resolved) {
      setInterruptModalOpen(true);
      setUiPaused(true);
      api.sessions.pause(sessionId);
    }
    if (!interruptState) setInterruptModalOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interruptState?.incidentId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function pauseGame() {
    setUiPaused(true);
    api.sessions.pause(sessionId);
  }
  function resumeGame() {
    setUiPaused(false); // unfreeze game logic immediately
    api.sessions.resume(sessionId).catch(() => {}); // backend extends timers + fires SSE
    // Visual freeze (pausedAt) is cleared by the incident:timer_extended SSE handler
    // once expiresAt is updated in the store. Fallback covers sessions with no pending incidents.
    setTimeout(() => useGameStore.getState().clearPausedAt(), 500);
  }

  function handleIncidentClick(incident: Incident) {
    if (incident.status === "pending") {
      setSelectedIncident(incident);
      setSelectedHeroIds([]);
      pauseGame();
    } else if (incident.status === "active" && interruptState?.incidentId === incident.id) {
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

  function handleEndShift() {
    reset();
    router.push("/shift");
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

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {(sessionComplete || gameOver) && (
        <ShiftEndScreen
          score={score}
          cityHealth={cityHealth}
          onEndShift={handleEndShift}
        />
      )}
      <GameLayout
        onIncidentClick={handleIncidentClick}
        onHeroClick={(hero) => { setSelectedHero(hero); pauseGame(); }}
        onEndShift={handleEndShift}
        shiftStarted={true}
        selectedIncident={selectedIncident}
        selectedHeroIds={selectedHeroIds}
        onHeroToggle={handleHeroToggle}
        onIncidentClose={() => { setSelectedIncident(null); setSelectedHeroIds([]); resumeGame(); }}
        onDispatched={() => {
          if (selectedIncident) {
            updateIncidentStatus(selectedIncident.id, "en_route");
            setIncidentHeroes(selectedIncident.id, selectedHeroIds);
          }
          setSelectedIncident(null);
          setSelectedHeroIds([]);
          resumeGame();
        }}
        startScreenSlot={null}
      />
      <HeroDetailModal hero={selectedHero} onClose={() => { setSelectedHero(null); resumeGame(); }} />
      {interruptModalOpen && (
        <InterruptModal onClose={() => { setInterruptModalOpen(false); resumeGame(); }} />
      )}
      <DragOverlay dropAnimation={null}>
        {draggingHeroId != null ? (() => {
          const hero = heroes.find((h) => h.id === draggingHeroId);
          if (!hero) return null;
          return (
            <div
              className="relative w-20 h-20 rounded overflow-hidden pointer-events-none"
              style={{
                border: "2px solid #fbbf24",
                boxShadow: "0 0 20px #fbbf2440, 0 8px 32px rgba(0,0,0,0.6)",
                transform: "scale(1.08)",
                opacity: 0.95,
              }}
            >
              {hero.portraitUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero.portraitUrl} alt={hero.alias} className="w-full h-full object-cover" />
              )}
              <div className="absolute bottom-0 left-0 right-0 py-1 text-center font-mono text-[8px] tracking-widest"
                style={{ backgroundColor: "#00000080", color: "#fbbf24" }}>
                {hero.alias.toUpperCase()}
              </div>
            </div>
          );
        })() : null}
      </DragOverlay>
      <RollRevealModal
        key={rollRevealIncidentId ?? ""}
        incidentId={rollRevealIncidentId}
        onClose={() => {
          setRollRevealIncidentId(null);
          resumeGame();
        }}
      />
      <DebriefModal
        outcome={debriefIncidentId != null ? (missionOutcomes[debriefIncidentId] ?? null) : null}
        incidentId={debriefIncidentId}
        onClose={() => { removeIncident(debriefIncidentId!); setDebriefIncidentId(null); resumeGame(); }}
      />
    </DndContext>
  );
}
