"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";
import type { Incident } from "@/types/api";

interface Props {
  incident: Incident;
  x: number;
  y: number;
  onClick: () => void;
  hasInterrupt: boolean;
}

const dangerColor = {
  1: "#22c55e",
  2: "#f97316",
  3: "#ef4444",
} as const;

const statusLabel: Partial<Record<Incident["status"], string>> = {
  en_route:   "EN ROUTE",
  active:     "ON SCENE",
  debriefing: "DEBRIEF",
};

const RING_RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function TimerRing({ createdAt, expiresAt, color }: { createdAt: string; expiresAt: string; color: string }) {
  const uiPaused = useGameStore((s) => s.uiPaused);

  const getProgress = () => {
    const total = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
    const remaining = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.min(1, remaining / total));
  };

  const [progress, setProgress] = useState(getProgress);

  useEffect(() => {
    setProgress(getProgress());
    if (uiPaused) return;
    const iv = setInterval(() => setProgress(getProgress()), 500);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, uiPaused]);

  const isUrgent = progress < 0.25;
  const strokeColor = isUrgent ? "#ef4444" : color;
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <svg
      width={50}
      height={50}
      className="absolute pointer-events-none"
      style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%) rotate(-90deg)" }}
    >
      {/* Dim track */}
      <circle
        cx={25} cy={25} r={RING_RADIUS}
        fill="none"
        stroke={`${strokeColor}25`}
        strokeWidth={2.5}
      />
      {/* Countdown arc */}
      <circle
        cx={25} cy={25} r={RING_RADIUS}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isUrgent ? 3 : 2.5}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: "stroke-dashoffset 0.5s linear",
          opacity: isUrgent ? 1 : progress > 0.6 ? 0.45 : 0.75,
          filter: isUrgent ? `drop-shadow(0 0 4px ${strokeColor})` : "none",
        }}
      />
    </svg>
  );
}

export function IncidentPin({ incident, x, y, onClick, hasInterrupt }: Props) {
  const color = dangerColor[incident.dangerLevel];
  const isPending = incident.status === "pending";
  const isDebriefing = incident.status === "debriefing";
  const isDispatched = ["en_route", "active"].includes(incident.status);
  const isClickable = isPending || isDebriefing || hasInterrupt;

  const label = statusLabel[incident.status] ?? incident.title;

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      className="absolute -translate-x-1/2 -translate-y-1/2 group"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        cursor: isClickable ? "pointer" : "default",
        width: 50,
        height: 50,
      }}
    >
      {/* Timer ring — only for pending incidents */}
      {isPending && incident.createdAt && (
        <TimerRing createdAt={incident.createdAt} expiresAt={incident.expiresAt} color={color} />
      )}

      {/* Outer scan ring — pulses for interrupt */}
      {hasInterrupt && (
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: 4,
            border: `1px solid ${color}`,
            animation: "ping 0.5s ease-in-out infinite",
          }}
        />
      )}

      {/* Mid ring */}
      <span
        className="absolute rounded-full pointer-events-none"
        style={{
          inset: 17,
          border: `1px solid ${color}${isDispatched ? "40" : "70"}`,
        }}
      />

      {/* Core diamond */}
      <span
        className="absolute"
        style={{
          top: "50%", left: "50%",
          width: 10, height: 10,
          transform: "translate(-50%, -50%) rotate(45deg)",
          backgroundColor: isDispatched ? "transparent" : color,
          border: `1.5px solid ${color}`,
          boxShadow: isDispatched ? "none" : `0 0 8px ${color}, 0 0 16px ${color}60`,
          opacity: isDispatched ? 0.5 : 1,
        }}
      />

      {/* Crosshair lines */}
      <span className="absolute pointer-events-none" style={{ top: "50%", left: 0, right: 0, height: 1, backgroundColor: `${color}30`, transform: "translateY(-50%)" }} />
      <span className="absolute pointer-events-none" style={{ left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: `${color}30`, transform: "translateX(-50%)" }} />

      {/* Label above */}
      <span
        className="absolute font-mono pointer-events-none whitespace-nowrap"
        style={{
          bottom: "calc(100% + 6px)",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 11,
          letterSpacing: "0.1em",
          color,
          opacity: isDispatched ? 0.6 : 1,
          backgroundColor: "rgba(0,0,0,0.75)",
          padding: "2px 6px",
          border: `1px solid ${color}40`,
          boxShadow: `0 0 10px ${color}30`,
        }}
      >
        {label.toUpperCase()}
      </span>

      {/* Action hint below */}
      {isDebriefing && (
        <span className="absolute font-mono pointer-events-none whitespace-nowrap"
          style={{ top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", fontSize: 10, letterSpacing: "0.1em", color: "#fbbf24", backgroundColor: "rgba(0,0,0,0.75)", padding: "2px 6px", border: "1px solid #fbbf2440" }}>
          ▼ CLICK
        </span>
      )}
      {hasInterrupt && (
        <span className="absolute font-mono pointer-events-none whitespace-nowrap"
          style={{ top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", fontSize: 10, letterSpacing: "0.1em", color, backgroundColor: "rgba(0,0,0,0.75)", padding: "2px 6px", border: `1px solid ${color}60` }}>
          ▼ ACT NOW
        </span>
      )}
    </button>
  );
}
