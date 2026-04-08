"use client";

import { CityMap } from "./CityMap";
import { LogPanel } from "./LogPanel";
import { RosterBar } from "./RosterBar";
import { GameHeader } from "./GameHeader";
import { IncidentModal } from "@/components/modals/IncidentModal";
import type { Hero, Incident } from "@/types/api";

interface Props {
  onIncidentClick: (incident: Incident) => void;
  onHeroClick: (hero: Hero) => void;
  onEndShift: () => void;
  shiftStarted: boolean;
  selectedIncident: Incident | null;
  selectedHeroIds: string[];
  onHeroToggle: (heroId: string) => void;
  onIncidentClose: () => void;
  onDispatched: () => void;
  startScreenSlot?: React.ReactNode;
  volume?: number;
  onVolumeChange?: (v: number) => void;
  linkedHeroAlias?: string | null;
}

export function GameLayout({
  onIncidentClick,
  onHeroClick,
  onEndShift,
  shiftStarted,
  selectedIncident,
  selectedHeroIds,
  onHeroToggle,
  onIncidentClose,
  onDispatched,
  startScreenSlot,
  volume,
  onVolumeChange,
  linkedHeroAlias,
}: Props) {
  const incidentOpen = !!selectedIncident;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <div className="h-10 shrink-0 border-b" style={{ borderColor: "var(--border)" }}>
        <GameHeader shiftStarted={shiftStarted} onEndShift={onEndShift} volume={volume} onVolumeChange={onVolumeChange} />
      </div>

      {/* Map + Log */}
      <div className="flex flex-1 min-h-0 relative">
        {/* City map */}
        <div className="flex-1 relative min-w-0">
          <CityMap onIncidentClick={onIncidentClick}>
            <IncidentModal
              incident={selectedIncident}
              selectedHeroIds={selectedHeroIds}
              onHeroToggle={onHeroToggle}
              onClose={onIncidentClose}
              onDispatched={onDispatched}
            />
          </CityMap>
        </div>

        {/* SDN Log — isolation contains CRT library's internal z-indexes */}
        {shiftStarted && (
          <div className="w-80 shrink-0 border-l overflow-hidden" style={{ borderColor: "var(--border)", backgroundColor: "var(--panel-inset)", isolation: "isolate" }}>
            <LogPanel />
          </div>
        )}

        {/* Start screen sits inside map+log area — roster stays visible below */}
        {startScreenSlot}
      </div>

      {/* Roster — visible only during shift */}
      {shiftStarted && (
        <div className="h-56 shrink-0">
          <RosterBar
            onHeroClick={onHeroClick}
            selectedHeroIds={incidentOpen ? selectedHeroIds : []}
            selectionMode={false}
            dragEnabled={incidentOpen}
            linkedHeroAlias={incidentOpen ? linkedHeroAlias : null}
          />
        </div>
      )}
    </div>
  );
}
