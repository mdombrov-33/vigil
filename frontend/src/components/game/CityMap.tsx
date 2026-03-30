"use client";

import Image from "next/image";
import { useGameStore } from "@/stores/gameStore";
import { cityLocations } from "@/lib/cityLocations";
import { IncidentPin } from "./IncidentPin";
import type { Incident } from "@/types/api";

interface Props {
  onIncidentClick: (incident: Incident) => void;
  children?: React.ReactNode;
}

// Assign a stable location slot to each active incident
function assignLocations(incidents: Incident[]) {
  const used = new Set<number>();
  return incidents.map((incident) => {
    const slot = cityLocations.find((loc) => !used.has(loc.id));
    if (slot) used.add(slot.id);
    return { incident, location: slot ?? cityLocations[0] };
  });
}

export function CityMap({ onIncidentClick, children }: Props) {
  const incidents = useGameStore((s) => s.incidents);
  const interruptState = useGameStore((s) => s.interruptState);
  const activeIncidents = incidents.filter(
    (i) => !["completed", "expired"].includes(i.status)
  );
  const assigned = assignLocations(activeIncidents);

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
      {/* Dark overlay to deepen the image */}
      <div className="absolute inset-0 bg-black/20" />

      {assigned.map(({ incident, location }) => (
        <IncidentPin
          key={incident.id}
          incident={incident}
          x={location.x}
          y={location.y}
          onClick={() => onIncidentClick(incident)}
          hasInterrupt={interruptState?.incidentId === incident.id}
        />
      ))}
      {children}
    </div>
  );
}
