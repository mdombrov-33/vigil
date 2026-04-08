"use client";

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "@/stores/gameStore";
import { sounds } from "@/sounds";
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
  1: { diamond: 7,  ringR: 17, color: "var(--success)", colorBorder: "var(--success-border)", colorSubtle: "var(--success-subtle)", extraRing: false },
  2: { diamond: 10, ringR: 19, color: "var(--warning)", colorBorder: "var(--warning-border)", colorSubtle: "var(--warning-subtle)", extraRing: false },
  3: { diamond: 13, ringR: 21, color: "var(--danger)",  colorBorder: "var(--danger-border)",  colorSubtle: "var(--danger-subtle)",  extraRing: true  },
} as const;

const CIRCUMFERENCE = (r: number) => 2 * Math.PI * r;

function TimerRing({
  createdAt,
  expiresAt,
  color,
  radius,
  strokeWidth = 1.5,
}: {
  createdAt: string;
  expiresAt: string;
  color: string;
  radius: number;
  strokeWidth?: number;
}) {
  const pausedAt = useGameStore((s) => s.pausedAt);
  const circ = CIRCUMFERENCE(radius);
  const size = (radius + 5) * 2;

  const totalMs = useRef(new Date(expiresAt).getTime() - new Date(createdAt).getTime());
  const remainingMs = useRef(new Date(expiresAt).getTime() - Date.now());
  const lastTickAt = useRef(Date.now());

  const [progress, setProgress] = useState(() =>
    Math.max(0, Math.min(1, remainingMs.current / totalMs.current))
  );

  // Freeze: snapshot remaining ms at pause moment
  useEffect(() => {
    if (pausedAt === null) return;
    remainingMs.current = Math.max(0, remainingMs.current - (pausedAt - lastTickAt.current));
    setProgress(Math.max(0, Math.min(1, remainingMs.current / totalMs.current)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedAt]);

  // Tick: decrement remainingMs by elapsed real time, no expiresAt involved
  useEffect(() => {
    if (pausedAt !== null) return;
    lastTickAt.current = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      remainingMs.current = Math.max(0, remainingMs.current - (now - lastTickAt.current));
      lastTickAt.current = now;
      setProgress(Math.max(0, Math.min(1, remainingMs.current / totalMs.current)));
    }, 500);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausedAt]);

  const isUrgent = progress < 0.25;
  const strokeColor = isUrgent ? "var(--danger)" : color;
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
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isUrgent ? strokeWidth + 0.5 : strokeWidth}
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
  const interruptState = useGameStore((s) => s.interruptState);
  function handleClick() { sounds.pinClick(); onClick(); }
  const color = cfg.color;

  const isPending    = incident.status === "pending";
  const isDispatched = incident.status === "en_route" || incident.status === "active";
  const isDebriefing = incident.status === "debriefing";
  const isClickable  = isPending || isDebriefing || hasInterrupt;

  // Interrupt overrides everything — it's an alarm state
  if (hasInterrupt) {
    const interruptCreatedAt = interruptState?.incidentId === incident.id
      ? interruptState.interruptCreatedAt
      : null;
    const interruptDurationMs = interruptState?.incidentId === incident.id
      ? interruptState.interruptDurationMs
      : null;
    const interruptExpiresAt = interruptCreatedAt && interruptDurationMs
      ? new Date(new Date(interruptCreatedAt).getTime() + interruptDurationMs).toISOString()
      : null;
    return (
      <button
        onClick={handleClick}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${x}%`, top: `${y}%`, width: 56, height: 56, cursor: "pointer" }}
      >
        {/* Interrupt timer ring — single thick ring */}
        {interruptCreatedAt && interruptExpiresAt && (
          <TimerRing
            createdAt={interruptCreatedAt}
            expiresAt={interruptExpiresAt}
            color="var(--danger)"
            radius={22}
            strokeWidth={4}
          />
        )}
        {/* Core */}
        <span
          className="absolute"
          style={{
            top: "50%", left: "50%",
            width: 14, height: 14,
            transform: "translate(-50%, -50%) rotate(45deg)",
            backgroundColor: "var(--danger)",
            boxShadow: "0 0 16px var(--danger), 0 0 32px var(--danger-border)",
          }}
        />
        {/* Label */}
        <span
          className="absolute font-mono whitespace-nowrap pointer-events-none"
          style={{
            top: "calc(100% + 5px)",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: "var(--danger)",
            backgroundColor: "var(--panel-inset)",
            padding: "2px 5px",
            border: "1px solid var(--danger-border)",
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
              stroke={cfg.colorBorder}
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
            backgroundColor: isActive ? cfg.colorBorder : "transparent",
            border: `1.5px solid ${cfg.colorBorder}`,
            boxShadow: isActive ? `0 0 6px ${cfg.colorSubtle}` : "none",
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
            color: cfg.color,
            backgroundColor: "#090806aa",
            padding: "1px 5px",
            border: `1px solid ${cfg.colorBorder}`,
          }}
        >
          {isActive ? "ON SCENE" : "ROUTING"}
        </span>
      </div>
    );
  }

  // Debriefing — clickable, amber weight
  if (isDebriefing) {
    const amber = "var(--text-amber)";
    return (
      <button
        onClick={handleClick}
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${x}%`, top: `${y}%`, width: 44, height: 44, cursor: "pointer" }}
      >
        {/* Outer ring */}
        <span
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: 8,
            border: "1px solid var(--amber-border)",
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
              ? `0 0 12px var(--text-amber), 0 0 24px var(--amber-subtle)`
              : `0 0 8px var(--amber-border), 0 0 16px var(--amber-subtle)`,
          }}
        />

        {/* Label */}
        <span
          className="absolute font-mono whitespace-nowrap pointer-events-none"
          style={{
            top: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: amber,
            backgroundColor: "#090806cc",
            padding: "2px 6px",
            border: "1px solid var(--amber-border)",
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
      onClick={isClickable ? handleClick : undefined}
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
            border: `1px solid ${cfg.colorSubtle}`,
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
          backgroundColor: cfg.color,
          boxShadow: `0 0 ${cfg.extraRing ? 14 : 8}px ${cfg.color}, 0 0 ${cfg.extraRing ? 28 : 16}px ${cfg.colorBorder}`,
        }}
      />

      {/* Title label below */}
      <span
        className="absolute font-mono pointer-events-none whitespace-nowrap"
        style={{
          top: "calc(100% + 7px)",
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.08em",
          color: cfg.color,
          opacity: 1,
          backgroundColor: "#090806cc",
          padding: "2px 6px",
          border: `1px solid ${cfg.colorBorder}`,
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
