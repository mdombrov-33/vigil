"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useGameStore } from "@/stores/gameStore";
import { useHeroes } from "@/hooks/useHeroes";
import { createSession } from "@/hooks/useSession";
import { useSSE } from "@/hooks/useSSE";
import { GameLayout } from "@/components/game/GameLayout";
import { StartScreen } from "@/components/game/StartScreen";
import { HeroDetailModal } from "@/components/modals/HeroDetailModal";
import { InterruptModal } from "@/components/modals/InterruptModal";
import { DebriefModal } from "@/components/modals/DebriefModal";
import type { Hero, Incident } from "@/types/api";

const SESSION_KEY = "vigil_session_id";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function GameRoot() {
  const { sessionId, setSession, reset, updateIncidentStatus, removeIncident, interruptState, missionOutcomes, setUiPaused } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shiftStarted, setShiftStarted] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>([]);
  const [selectedHero, setSelectedHero] = useState<Hero | null>(null);
  const [interruptModalOpen, setInterruptModalOpen] = useState(false);
  const [debriefIncidentId, setDebriefIncidentId] = useState<string | null>(null);
  const [draggingHeroId, setDraggingHeroId] = useState<string | null>(null);
  const { data: heroes = [] } = useHeroes();
  const queryClient = useQueryClient();

  useSSE(shiftStarted ? sessionId : null);

  // Hide cursor while dragging so only the portrait overlay is visible
  useEffect(() => {
    document.body.style.cursor = draggingHeroId != null ? "none" : "";
    return () => { document.body.style.cursor = ""; };
  }, [draggingHeroId]);

  // Preload all portrait images so DragOverlay renders instantly on first drag
  useEffect(() => {
    heroes.forEach((h) => {
      if (h.portraitUrl) new Image().src = h.portraitUrl;
    });
  }, [heroes]);

  // Auto-close interrupt modal when the interrupt is cleared (timed out or resolved + dismissed)
  useEffect(() => {
    if (!interruptState) setInterruptModalOpen(false);
  }, [interruptState]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    const isValidUuid = stored && /^[0-9a-f-]{36}$/.test(stored);
    if (isValidUuid) {
      setSession(stored, 100, 0);
      return;
    }
    if (stored) localStorage.removeItem(SESSION_KEY);
    setLoading(true);
    createSession()
      .then((session) => {
        localStorage.setItem(SESSION_KEY, session.id);
        setSession(session.id, session.cityHealth, session.score);
      })
      .catch((err) => {
        console.error(err);
        setError("Cannot reach backend — is it running on port 3001?");
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function pauseGame() {
    setUiPaused(true);
    if (sessionId) fetch(`${API}/api/v1/sessions/${sessionId}/pause`, { method: "POST" });
  }
  function resumeGame() {
    setUiPaused(false);
    if (sessionId) fetch(`${API}/api/v1/sessions/${sessionId}/resume`, { method: "POST" });
  }

  function handleIncidentClick(incident: Incident) {
    if (incident.status === "pending") {
      setSelectedIncident(incident);
      setSelectedHeroIds([]);
      pauseGame();
    } else if (incident.status === "active" && interruptState?.incidentId === incident.id) {
      setInterruptModalOpen(true);
      pauseGame();
    } else if (incident.status === "debriefing") {
      setDebriefIncidentId(incident.id);
      pauseGame();
    }
  }

  async function handleStartShift() {
    if (!sessionId) return;
    reset();
    setSession(sessionId, 100, 0);
    await fetch(`${API}/api/v1/sessions/${sessionId}/start`, { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["heroes"] });
    setShiftStarted(true);
  }

  function handleEndShift() {
    setShiftStarted(false);
    setSelectedIncident(null);
    setSelectedHeroIds([]);
    setSelectedHero(null);
    reset();
    localStorage.removeItem(SESSION_KEY);
    createSession().then((session) => {
      localStorage.setItem(SESSION_KEY, session.id);
      setSession(session.id, session.cityHealth, session.score);
    });
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
    handleHeroToggle(heroId);
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center font-mono text-sm" style={{ backgroundColor: "#08080f", color: "#fbbf24" }}>
        Connecting to SDN...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center font-mono text-sm gap-3" style={{ backgroundColor: "#08080f", color: "#ef4444" }}>
        <span>{error}</span>
        <button onClick={() => { setError(null); setLoading(true); createSession().then((s) => { localStorage.setItem(SESSION_KEY, s.id); setSession(s.id, s.cityHealth, s.score); }).catch((e) => setError(String(e))).finally(() => setLoading(false)); }} className="text-xs underline opacity-60 hover:opacity-100">
          retry
        </button>
      </div>
    );
  }

  if (!sessionId) return null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <GameLayout
        onIncidentClick={handleIncidentClick}
        onHeroClick={(hero) => { setSelectedHero(hero); pauseGame(); }}
        onEndShift={handleEndShift}
        shiftStarted={shiftStarted}
        selectedIncident={selectedIncident}
        selectedHeroIds={selectedHeroIds}
        onHeroToggle={handleHeroToggle}
        onIncidentClose={() => { setSelectedIncident(null); setSelectedHeroIds([]); resumeGame(); }}
        onDispatched={() => {
          if (selectedIncident) updateIncidentStatus(selectedIncident.id, "en_route");
          setSelectedIncident(null);
          setSelectedHeroIds([]);
          resumeGame();
        }}
        startScreenSlot={
          <AnimatePresence>
            {!shiftStarted && <StartScreen onStart={handleStartShift} />}
          </AnimatePresence>
        }
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
      <DebriefModal
        outcome={debriefIncidentId != null ? (missionOutcomes[debriefIncidentId] ?? null) : null}
        incidentId={debriefIncidentId}
        onClose={() => { removeIncident(debriefIncidentId!); setDebriefIncidentId(null); resumeGame(); }}
      />
    </DndContext>
  );
}

export default function Home() {
  return <GameRoot />;
}
