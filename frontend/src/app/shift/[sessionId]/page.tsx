"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/hooks/useSession";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useGameStore } from "@/stores/gameStore";
import { useHeroes } from "@/hooks/useHeroes";
import { useSSE } from "@/hooks/useSSE";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import { useGameModals } from "@/hooks/useGameModals";
import { GameLayout } from "@/components/game/GameLayout";
import { ShiftEndScreen } from "@/components/game/ShiftEndScreen";
import { HeroDetailModal } from "@/components/modals/HeroDetailModal";
import { InterruptModal } from "@/components/modals/InterruptModal";
import { DebriefModal } from "@/components/modals/DebriefModal";
import { RollRevealModal } from "@/components/modals/RollRevealModal";

export default function ActiveShiftPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const queryClient = useQueryClient();

  const { setSession, reset, missionOutcomes, sessionComplete, gameOver, score, cityHealth } = useGameStore();
  const { start: startMusic, stop: stopMusic, volume, setVolume } = useBackgroundMusic();
  const { data: heroes = [] } = useHeroes();
  const { data: sessionData } = useSession(sessionId);

  const modals = useGameModals(sessionId);

  useSSE(sessionId);

  // Reset store on mount, start music
  useEffect(() => {
    reset();
    setSession(sessionId, 100, 0);
    queryClient.invalidateQueries({ queryKey: ["heroes"] });
    startMusic();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate city health + score from server once session data arrives
  useEffect(() => {
    if (sessionData) setSession(sessionId, sessionData.cityHealth, sessionData.score);
  }, [sessionData?.cityHealth, sessionData?.score]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide cursor while dragging
  useEffect(() => {
    document.body.style.cursor = modals.draggingHeroId != null ? "none" : "";
    return () => { document.body.style.cursor = ""; };
  }, [modals.draggingHeroId]);

  // Preload portraits for instant DragOverlay
  useEffect(() => {
    heroes.forEach((h) => { if (h.portraitUrl) new Image().src = h.portraitUrl; });
  }, [heroes]);

  function handleEndShift() {
    stopMusic();
    reset();
    router.push("/shift");
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  return (
    <DndContext sensors={sensors} onDragStart={modals.handleDragStart} onDragEnd={modals.handleDragEnd}>
      {(sessionComplete || gameOver) && (
        <ShiftEndScreen score={score} cityHealth={cityHealth} onEndShift={handleEndShift} />
      )}
      <GameLayout
        onIncidentClick={modals.handleIncidentClick}
        onHeroClick={modals.openHeroDetail}
        onEndShift={handleEndShift}
        shiftStarted={true}
        selectedIncident={modals.selectedIncident}
        selectedHeroIds={modals.selectedHeroIds}
        onHeroToggle={modals.handleHeroToggle}
        onIncidentClose={modals.closeIncident}
        onDispatched={modals.handleDispatched}
        startScreenSlot={null}
        volume={volume}
        onVolumeChange={setVolume}
        linkedHeroAlias={modals.selectedIncident?.linkedHeroAlias ?? null}
      />
      <HeroDetailModal hero={modals.selectedHero} onClose={modals.closeHeroDetail} />
      {modals.interruptModalOpen && (
        <InterruptModal onClose={modals.closeInterrupt} />
      )}
      <DragOverlay dropAnimation={null}>
        {modals.draggingHeroId != null ? (() => {
          const hero = heroes.find((h) => h.id === modals.draggingHeroId);
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
        key={modals.rollRevealIncidentId ?? ""}
        incidentId={modals.rollRevealIncidentId}
        onClose={modals.closeRollReveal}
      />
      <DebriefModal
        outcome={modals.debriefIncidentId != null ? (missionOutcomes[modals.debriefIncidentId] ?? null) : null}
        incidentId={modals.debriefIncidentId}
        onClose={() => modals.closeDebrief(modals.debriefIncidentId!)}
      />
    </DndContext>
  );
}
