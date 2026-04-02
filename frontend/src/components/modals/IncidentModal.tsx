"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useDroppable } from "@dnd-kit/core";
import { useHeroes } from "@/hooks/useHeroes";
import type { Incident } from "@/types/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const dangerMeta = {
  1: { color: "#22c55e", label: "MINOR" },
  2: { color: "#f97316", label: "STANDARD" },
  3: { color: "#ef4444", label: "CRITICAL" },
} as const;

interface SlotProps {
  index: number;
  heroId: string | null;
  dangerColor: string;
  onRemove: () => void;
}

function HeroSlot({ index, heroId, dangerColor, onRemove }: SlotProps) {
  const { data: heroes = [] } = useHeroes();
  const hero = heroes.find((h) => h.id === heroId) ?? null;
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });

  return (
    <div
      ref={setNodeRef}
      className="relative w-16 h-16 rounded overflow-hidden transition-all"
      style={{
        border: `1px solid ${isOver ? dangerColor : hero ? dangerColor + "80" : "#2a2a40"}`,
        backgroundColor: isOver ? dangerColor + "15" : "#0d0d1a",
        boxShadow: isOver ? `0 0 10px ${dangerColor}40` : "none",
      }}
    >
      {hero ? (
        <>
          <Image src={hero.portraitUrl ?? ""} alt={hero.alias} fill sizes="64px" className="object-cover" />
          <button
            onClick={onRemove}
            className="absolute inset-0 bg-black/0 hover:bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-all"
          >
            <span className="text-white text-sm">✕</span>
          </button>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border border-dashed" style={{ borderColor: isOver ? dangerColor : "#2a2a40" }} />
        </div>
      )}
    </div>
  );
}

interface Props {
  incident: Incident | null;
  selectedHeroIds: string[];
  onHeroToggle: (heroId: string) => void;
  onClose: () => void;
  onDispatched: () => void;
}

async function dispatchHeroes(incidentId: string, heroIds: string[]) {
  const res = await fetch(`${API}/api/v1/incidents/${incidentId}/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ heroIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Dispatch failed");
  }
}

export function IncidentModal({ incident, selectedHeroIds, onHeroToggle, onClose, onDispatched }: Props) {
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDispatching(false);
    setError(null);
  }, [incident?.id]);

  const danger = incident ? dangerMeta[incident.dangerLevel] : null;
  const slotCount = incident?.slotCount ?? 1;
  const canDispatch = selectedHeroIds.length >= 1 && !dispatching;

  async function handleDispatch() {
    if (!incident || !canDispatch) return;
    setDispatching(true);
    setError(null);
    try {
      await dispatchHeroes(incident.id, selectedHeroIds);
      onDispatched();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dispatch failed");
      setDispatching(false);
    }
  }

  return (
    <AnimatePresence>
      {incident && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-20 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            {/* Panel */}
            <motion.div
              className="relative w-full max-w-xl flex flex-col overflow-hidden"
              style={{
                backgroundColor: "var(--panel)",
                border: `1px solid ${danger?.color}30`,
                maxHeight: "min(520px, 90%)",
              }}
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Danger color top bar */}
              <div className="h-0.5 shrink-0" style={{ backgroundColor: danger?.color }} />

              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: danger?.color, boxShadow: `0 0 6px ${danger?.color}` }} />
                    <span className="font-mono text-[9px] tracking-widest" style={{ color: danger?.color }}>
                      {danger?.label}
                    </span>
                  </div>
                  <h2 className="font-mono text-lg font-bold tracking-wide leading-tight" style={{ color: "var(--text-amber)" }}>
                    {incident.title.toUpperCase()}
                  </h2>
                </div>
                <button onClick={onClose} className="font-mono text-xs shrink-0 mt-1 transition-opacity hover:opacity-100"
                  style={{ color: "var(--text-muted)" }}>✕</button>
              </div>

              {/* Body — single scrollable column */}
              <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 flex flex-col gap-4">
                {/* Flavor description */}
                <p className="font-mono text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  {incident.description}
                </p>

                {/* Field intel hints */}
                {incident.hints.length > 0 && (
                  <div>
                    <div className="font-mono text-[9px] tracking-widest mb-2.5" style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                      FIELD INTEL
                    </div>
                    <ul className="flex flex-col gap-2">
                      {incident.hints.map((hint, i) => (
                        <li key={i} className="flex gap-2.5 items-start">
                          <span className="font-mono text-[9px] mt-0.5 shrink-0" style={{ color: danger?.color }}>▸</span>
                          <span className="font-mono text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {hint}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Footer — slots centered + dispatch */}
              <div className="shrink-0 px-5 py-4 flex flex-col items-center gap-3" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-secondary)" }}>
                  {selectedHeroIds.length === 0
                    ? "Select heroes from roster"
                    : `${selectedHeroIds.length} / ${slotCount} selected`}
                </div>
                <div className="flex gap-2 justify-center">
                  {Array.from({ length: slotCount }).map((_, i) => (
                    <HeroSlot
                      key={i}
                      index={i}
                      heroId={selectedHeroIds[i] ?? null}
                      dangerColor={danger?.color ?? "#ffffff"}
                      onRemove={() => onHeroToggle(selectedHeroIds[i])}
                    />
                  ))}
                </div>
                {error && (
                  <div className="font-mono text-[10px]" style={{ color: "var(--danger)" }}>{error}</div>
                )}
                <motion.button
                  onClick={handleDispatch}
                  disabled={!canDispatch}
                  className="w-full max-w-xs py-2.5 font-mono text-xs tracking-widest uppercase"
                  style={{
                    backgroundColor: canDispatch ? danger?.color : "var(--border)",
                    color: canDispatch ? "#000" : "var(--text-muted)",
                    cursor: canDispatch ? "pointer" : "not-allowed",
                  }}
                  whileTap={canDispatch ? { scale: 0.98 } : {}}
                >
                  {dispatching ? "Dispatching..." : "Dispatch"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
