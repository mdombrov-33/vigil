"use client";

import Image from "next/image";
import { useGameStore } from "@/stores/gameStore";
import { cityLocations } from "@/config/cityLocations";
import { IncidentPin } from "./IncidentPin";
import { HeroTravelers } from "./HeroTravelers";
import type { Incident } from "@/types/api";

interface Props {
  onIncidentClick: (incident: Incident) => void;
  children?: React.ReactNode;
}

export function CityMap({ onIncidentClick, children }: Props) {
  const incidents     = useGameStore((s) => s.incidents);
  const interruptState = useGameStore((s) => s.interruptState);
  const missionOutcomes = useGameStore((s) => s.missionOutcomes);
  const incidentSlots  = useGameStore((s) => s.incidentSlots);
  const incidentHeroes = useGameStore((s) => s.incidentHeroes);

  const activeIncidents = incidents.filter(
    (i) => !["completed", "expired"].includes(i.status)
  );

  return (
    <div className="relative w-full h-full overflow-hidden">
      <Image
        src="/map.webp"
        alt="City map"
        fill
        className="object-cover object-center"
        priority
        draggable={false}
      />
      <div className="absolute inset-0 bg-black/20" />

      <HeroTravelers
        incidents={activeIncidents}
        incidentSlots={incidentSlots}
        incidentHeroes={incidentHeroes}
      />

      {activeIncidents.map((incident) => {
        const slotId = incidentSlots[incident.id];
        const location = cityLocations.find((l) => l.id === slotId) ?? cityLocations[0];
        return (
          <IncidentPin
            key={incident.id}
            incident={incident}
            x={location.x}
            y={location.y}
            onClick={() => onIncidentClick(incident)}
            hasInterrupt={interruptState?.incidentId === incident.id}
            rollPending={missionOutcomes[incident.id]?.rollRevealed === false}
          />
        );
      })}

      {children}
    </div>
  );
}
