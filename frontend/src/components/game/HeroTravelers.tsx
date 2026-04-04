"use client";

import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useHeroes } from "@/hooks/useHeroes";
import { cityLocations } from "@/lib/cityLocations";
import type { Incident } from "@/types/api";

// Fixed HQ — heroes depart from here
export const HQ = { x: 50, y: 92 };

const dangerColor = {
  1: "#22c55e",
  2: "#f97316",
  3: "#ef4444",
} as const;

const TRAVEL_DURATION = 11; // matches backend 12s sleep

interface Props {
  incidents: Incident[];
  incidentSlots: Record<string, number>;
  incidentHeroes: Record<string, string[]>;
}

export function HeroTravelers({ incidents, incidentSlots, incidentHeroes }: Props) {
  const { data: heroes = [] } = useHeroes();

  const traveling = incidents.filter(
    (i) => i.status === "en_route" || i.status === "active"
  );

  return (
    <>
      {/* HQ marker */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: `${HQ.x}%`, top: `${HQ.y}%` }}
      >
        <span
          className="font-mono text-[7px] tracking-widest px-1.5 py-0.5"
          style={{
            color: "#fbbf2450",
            border: "1px solid #fbbf2420",
            backgroundColor: "#06060ecc",
          }}
        >
          HQ
        </span>
      </div>

      {traveling.flatMap((incident) => {
        const slotId = incidentSlots[incident.id];
        const location = cityLocations.find((l) => l.id === slotId);
        if (!location) return [];

        const heroIds = incidentHeroes[incident.id] ?? [];
        const color = dangerColor[incident.dangerLevel];
        const isActive = incident.status === "active";
        const count = heroIds.length;

        return heroIds.map((heroId, index) => {
          const hero = heroes.find((h) => h.id === heroId);
          if (!hero) return null;

          // Spread horizontally — heroes sit above the pin so they
          // don't collide with the ON SCENE label below it
          const spreadX = (index - (count - 1) / 2) * 24;

          return (
            <motion.div
              key={`${incident.id}-${heroId}`}
              className="absolute pointer-events-none"
              style={{
                width: 28,
                height: 28,
                marginLeft: -14,
                marginTop: -14,
                zIndex: 10 + (count - index),
              }}
              initial={isActive
                ? false
                : { left: `${HQ.x}%`, top: `${HQ.y}%`, x: 0, y: 0, opacity: 0 }
              }
              animate={{
                left: `${location.x}%`,
                top: `${location.y}%`,
                x: spreadX,
                y: isActive ? -32 : 0, // above pin when settled, not on top of label
                opacity: 1,
              }}
              transition={isActive
                ? { duration: 0.4, ease: "easeOut" }
                : {
                    left:    { duration: TRAVEL_DURATION, ease: "easeInOut", delay: index * 0.4 },
                    top:     { duration: TRAVEL_DURATION, ease: "easeInOut", delay: index * 0.4 },
                    x:       { duration: TRAVEL_DURATION, ease: "easeInOut", delay: index * 0.4 },
                    opacity: { duration: 0.3, delay: index * 0.4 },
                  }
              }
            >
              <Avatar
                size="sm"
                className="ring-0"
                style={{
                  width: 28,
                  height: 28,
                  outline: `2px solid ${color}`,
                  outlineOffset: 1,
                  boxShadow: `0 0 8px ${color}70, 0 2px 8px rgba(0,0,0,0.7)`,
                }}
              >
                <AvatarImage src={hero.portraitUrl ?? ""} alt={hero.alias} className="object-top" />
                <AvatarFallback
                  className="font-mono text-[9px]"
                  style={{ backgroundColor: "#0d0d1a", color }}
                >
                  {hero.alias[0]}
                </AvatarFallback>
              </Avatar>
            </motion.div>
          );
        });
      })}
    </>
  );
}
