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
  rollPending?: boolean;
}

// Danger level → visual config
const DANGER_CONFIG = {
  1: { diamond: 7,  ringR: 17, color: "#22c55e", extraRing: false },
  2: { diamond: 10, ringR: 19, color: "#f97316", extraRing: false },
  3: { diamond: 13, ringR: 21, color: "#ef4444", extraRing: true  },
} as const;

const CIRCUMFERENCE = (r: number) => 2 * Math.PI * r;

function TimerRing({
  createdAt,
  expiresAt,
  color,
  radius,
}: {
  createdAt: string;
  expiresAt: string;
  color: string;
  radius: number;
}) {
  const pausedAt = useGameStore((s) => s.pausedAt);
  const circ = CIRCUMFERENCE(radius);
  const size = (radius + 5) * 2;

  const compute = (now: number) => {
    const total = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
    const remaining = new Date(expiresAt).getTime() - now;
    return Math.max(0, Math.min(1, remaining / total));
  };

  const [progress, setProgress] = useState(() => compute(Date.now()));

  useEffect(() => {
    if (pausedAt === null) return;
    setProgress(compute(pausedAt));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedAt]);

  useEffect(() => {
    if (pausedAt !== null) return;
    setProgress(compute(Date.now()));
    const iv = setInterval(() => setProgress(compute(Date.now())), 500);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, pausedAt]);

  const isUrgent = progress < 0.25;
  const strokeColor = isUrgent ? "#ef4444" : color;
  const offset = circ * (1 - progress);
  const opacity = isUrgent ? 1 : progress > 0.6 ? 0.35 : 0.6;

  return (
    <svg
      width={size}
      height={size}
      className="absolute pointer-events-none"
      style={{
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%) rotate(-90deg)",
        overflow: "visible",
      }}
    >
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={`${strokeColor}18`}
        strokeWidth={1.5}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isUrgent ? 2 : 1.5}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: "stroke-dashoffset 0.5s linear",
          opacity,
          filter: isUrgent ? `drop-shadow(0 0 3px ${strokeColor})` : "none",
        }}
      />
    </svg>
  );
}

export function IncidentPin({ incident, x, y, onClick, hasInterrupt, rollPending }: Props) {
  const cfg = DANGER_CONFIG[incident.dangerLevel];
  const color = cfg.color;

  const isPending    = incident.status === "pending";
  const isDispatched = incident.status === "en_route" || incident.status === "active";
  const isDebriefing = incident.status === "debriefing";
  const isClickable  = isPending || isDebriefing || hasInterrupt;

  // Interrupt overrides everything — it's an alarm state
  if (hasInterrupt) {
    return (
      <button
        onClick={onClick}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${x}%`, top: `${y}%`, width: 56, height: 56, cursor: "pointer" }}
      >
        {/* Aggressive outer pulse */}
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: 0,
            border: "1px solid #ef4444",
            animation: "ping 0.6s ease-out infinite",
            opacity: 0.7,
          }}
        />
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: 6,
            border: "1px solid #ef444480",
            animation: "ping 0.6s ease-out 0.2s infinite",
          }}
        />
        {/* Core */}
        <span
          className="absolute"
          style={{
            top: "50%", left: "50%",
            width: 12, height: 12,
            transform: "translate(-50%, -50%) rotate(45deg)",
            backgroundColor: "#ef4444",
            boxShadow: "0 0 12px #ef4444, 0 0 24px #ef444460",
          }}
        />
        {/* Label */}
        <span
          className="absolute font-mono whitespace-nowrap pointer-events-none"
          style={{
            top: "calc(100% + 5px)",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 9,
            letterSpacing: "0.12em",
            color: "#ef4444",
            backgroundColor: "#0a000088",
            padding: "2px 5px",
            border: "1px solid #ef444460",
          }}
        >
          ACT NOW
        </span>
      </button>
    );
  }

  // Dispatched — visible but not demanding attention
  if (isDispatched) {
    const isActive = incident.status === "active";
    return (
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: `${x}%`, top: `${y}%`, width: 44, height: 44 }}
      >
        {/* Orbit ring for en_route — slow spin shows movement */}
        {!isActive && (
          <svg
            width={44} height={44}
            className="absolute pin-orbit"
            style={{ top: "50%", left: "50%", overflow: "visible" }}
          >
            <circle
              cx={22} cy={22} r={14}
              fill="none"
              stroke={`${color}55`}
              strokeWidth={1}
              strokeDasharray="4 6"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Core diamond */}
        <span
          className="absolute"
          style={{
            top: "50%", left: "50%",
            width: isActive ? 9 : 7, height: isActive ? 9 : 7,
            transform: "translate(-50%, -50%) rotate(45deg)",
            backgroundColor: isActive ? `${color}70` : "transparent",
            border: `1.5px solid ${color}${isActive ? "80" : "60"}`,
            boxShadow: isActive ? `0 0 6px ${color}40` : "none",
          }}
        />

        {/* Status label */}
        <span
          className="absolute font-mono whitespace-nowrap"
          style={{
            top: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 9,
            letterSpacing: "0.1em",
            color: `${color}70`,
            backgroundColor: "#06060eaa",
            padding: "1px 5px",
            border: `1px solid ${color}25`,
          }}
        >
          {isActive ? "ON SCENE" : "ROUTING"}
        </span>
      </div>
    );
  }

  // Debriefing — clickable, amber weight
  if (isDebriefing) {
    const amber = "#fbbf24";
    return (
      <button
        onClick={onClick}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${x}%`, top: `${y}%`, width: 44, height: 44, cursor: "pointer" }}
      >
        {/* Outer ring */}
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: 8,
            border: `1px solid ${amber}60`,
          }}
        />

        {/* Core */}
        <span
          className="absolute"
          style={{
            top: "50%", left: "50%",
            width: 10, height: 10,
            transform: "translate(-50%, -50%) rotate(45deg)",
            backgroundColor: amber,
            border: `1px solid ${amber}`,
            boxShadow: rollPending
              ? `0 0 12px ${amber}90, 0 0 24px ${amber}40`
              : `0 0 8px ${amber}60, 0 0 16px ${amber}25`,
          }}
        />

        {/* Label */}
        <span
          className="absolute font-mono whitespace-nowrap pointer-events-none"
          style={{
            top: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 9,
            letterSpacing: "0.12em",
            color: amber,
            backgroundColor: "#06060ecc",
            padding: "2px 6px",
            border: `1px solid ${amber}50`,
          }}
        >
          {rollPending ? "ROLL" : "DEBRIEF"}
        </span>
      </button>
    );
  }

  // Pending — primary state, full visual weight by danger level
  return (
    <button
      onClick={isClickable ? onClick : undefined}
      className="absolute -translate-x-1/2 -translate-y-1/2 group"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: 50,
        height: 50,
        cursor: isClickable ? "pointer" : "default",
      }}
    >
      {/* Timer ring */}
      {incident.createdAt && (
        <TimerRing
          createdAt={incident.createdAt}
          expiresAt={incident.expiresAt}
          color={color}
          radius={cfg.ringR}
        />
      )}

      {/* Extra outer pulse for danger 3 */}
      {cfg.extraRing && (
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: 2,
            border: `1px solid ${color}40`,
            animation: "ping 2s ease-out infinite",
          }}
        />
      )}

      {/* Core diamond */}
      <span
        className="absolute"
        style={{
          top: "50%", left: "50%",
          width: cfg.diamond, height: cfg.diamond,
          transform: "translate(-50%, -50%) rotate(45deg)",
          backgroundColor: color,
          boxShadow: `0 0 ${cfg.extraRing ? 14 : 8}px ${color}, 0 0 ${cfg.extraRing ? 28 : 16}px ${color}50`,
        }}
      />

      {/* Title label below */}
      <span
        className="absolute font-mono pointer-events-none whitespace-nowrap"
        style={{
          top: "calc(100% + 7px)",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 9,
          letterSpacing: "0.08em",
          color,
          opacity: 0.85,
          backgroundColor: "#06060ecc",
          padding: "2px 6px",
          border: `1px solid ${color}35`,
          maxWidth: 160,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {incident.title.toUpperCase()}
      </span>
    </button>
  );
}
