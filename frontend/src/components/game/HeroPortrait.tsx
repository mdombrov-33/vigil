"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { useGameStore } from "@/stores/gameStore";
import type { Hero } from "@/types/api";

interface Props {
  hero: Hero;
  onClick: () => void;
  selected?: boolean;
  selectable?: boolean;
  draggable?: boolean;
  linked?: boolean; // true when this hero is tied to the current incident's personal arc
}

function useCooldownDisplay(cooldownUntil: string | null) {
  const pausedAt = useGameStore((s) => s.pausedAt);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Freeze on pause — only fires when pausedAt changes, not when cooldownUntil changes.
  // This prevents hero:state_update SSE (arriving while paused) from corrupting the display.
  useEffect(() => {
    if (pausedAt === null || !cooldownUntil) return;
    setSecondsLeft(Math.max(0, Math.floor((new Date(cooldownUntil).getTime() - pausedAt) / 1000)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedAt]);

  // Tick when not paused — also re-runs after resume so cooldownUntil is fresh.
  useEffect(() => {
    if (pausedAt !== null || !cooldownUntil) return;
    const calc = () => Math.max(0, Math.floor((new Date(cooldownUntil).getTime() - Date.now()) / 1000));
    setSecondsLeft(calc());
    const interval = setInterval(() => setSecondsLeft(calc()), 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil, pausedAt]);

  return secondsLeft;
}

export function HeroPortrait({ hero, onClick, selected, selectable, draggable: isDraggable = false, linked = false }: Props) {
  const heroState = useGameStore((s) => s.heroStates[hero.id]);
  const availability = heroState?.availability ?? hero.availability;
  const health = heroState?.health ?? hero.health;
  const cooldownUntil = heroState?.cooldownUntil ?? hero.cooldownUntil;
  const secondsLeft = useCooldownDisplay(cooldownUntil);

  const isDown = health === "down";
  const isResting = availability === "resting";
  const isOnMission = availability === "on_mission";
  const isAvailable = availability === "available" && !isDown;

  const portraitSrc = health === "injured" && hero.injuredPortraitUrl
    ? hero.injuredPortraitUrl
    : hero.portraitUrl;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `hero-${hero.id}`,
    data: { heroId: hero.id },
    disabled: !isDraggable || !isAvailable,
  });

  const borderColor = isDown      ? "var(--danger-border)"
    : isOnMission                 ? "var(--info-border)"
    : selected                    ? "var(--info)"
    : linked                      ? "var(--amber-border)"
    : "var(--border)";

  return (
    <button
      ref={setNodeRef}
      {...(isDraggable ? { ...listeners, ...attributes } : {})}
      onClick={onClick}
      disabled={selectable === false}
      title={hero.alias}
      className="relative flex flex-col items-center gap-2 group shrink-0 min-w-[160px]"
      style={{
        opacity: isDown ? 0.35 : isResting ? 0.65 : isDragging ? 0.4 : 1,
        cursor: isDraggable && isAvailable ? "grab" : "pointer",
      }}
    >
      <div
        className={`relative w-36 h-36 rounded overflow-hidden transition-all ${linked ? "animate-pulse" : ""}`}
        style={{
          border: `2px solid ${borderColor}`,
          boxShadow: isOnMission ? "0 0 14px var(--info-subtle)" : selected ? "0 0 14px var(--info-border)" : linked ? "0 0 16px var(--amber-subtle)" : "none",
          transform: isDragging ? "scale(1.05)" : "none",
        }}
      >
        {portraitSrc ? (
          <Image
            src={portraitSrc}
            alt={hero.alias}
            fill
            sizes="144px"
            className={`object-cover transition-all group-hover:scale-105 ${isDown ? "grayscale" : ""} ${isOnMission ? "brightness-75 saturate-50" : ""}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg font-mono" style={{ backgroundColor: "var(--panel-inset)", color: "var(--amber-subtle)" }}>
            {hero.alias[0]}
          </div>
        )}

        {isOnMission && (
          <div className="absolute inset-0 flex items-end justify-center pb-2"
            style={{ background: "linear-gradient(to bottom, transparent 40%, #00000090 100%)" }}>
            <span className="font-mono text-[9px] font-bold tracking-[0.2em]"
              style={{ color: "var(--info)", textShadow: "0 0 10px var(--info-subtle)" }}>
              DEPLOYED
            </span>
          </div>
        )}

        {isResting && secondsLeft > 0 && (
          <div className="absolute inset-0 flex items-end justify-center pb-1" style={{ background: "linear-gradient(to top, #000000cc 40%, transparent)" }}>
            <span className="font-mono text-[10px]" style={{ color: "var(--text-amber)", textShadow: "0 0 8px var(--amber-subtle)" }}>{secondsLeft}s</span>
          </div>
        )}

        {isDown && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <span className="font-mono font-bold tracking-widest" style={{ fontSize: 11, letterSpacing: "0.15em", color: "var(--danger)", transform: "rotate(-15deg)" }}>OFFLINE</span>
          </div>
        )}

        {selected && (
          <div className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--info)" }}>
            <span className="text-[9px] text-white font-bold">✓</span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-xs tracking-wider truncate max-w-[144px] text-center"
          style={{ color: isOnMission ? "var(--info)" : isAvailable ? "var(--text-primary)" : "var(--text-muted)" }}>
          {hero.alias.toUpperCase()}
        </span>
        {(() => {
          const chip = isDown
            ? { label: "OFFLINE",  color: "var(--danger)",     bg: "var(--danger-subtle)",  border: "var(--danger-border)"  }
            : isOnMission
            ? { label: "DEPLOYED", color: "var(--info)",        bg: "var(--info-subtle)",    border: "var(--info-border)"    }
            : isResting
            ? { label: secondsLeft > 0 ? `${secondsLeft}s` : "RESTING", color: "var(--text-amber)", bg: "var(--amber-subtle)", border: "var(--amber-border)" }
            : health === "injured"
            ? { label: "INJURED",  color: "var(--warning)",    bg: "var(--warning-subtle)", border: "var(--warning-border)" }
            : null;
          if (chip) {
            return (
              <span className="font-mono text-[8px] tracking-widest px-2 py-0.5"
                style={{ color: chip.color, backgroundColor: chip.bg, border: `1px solid ${chip.border}` }}>
                {chip.label}
              </span>
            );
          }
          return (
            <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", backgroundColor: "var(--success-subtle)" }} />
          );
        })()}
      </div>
    </button>
  );
}
