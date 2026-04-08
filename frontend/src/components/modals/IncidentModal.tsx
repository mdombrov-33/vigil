"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sounds } from "@/sounds";
import Image from "next/image";
import { useDroppable } from "@dnd-kit/core";
import { useMutation } from "@tanstack/react-query";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { useHeroes } from "@/hooks/useHeroes";
import { api } from "@/api";
import type { Incident } from "@/types/api";

export const dangerMeta = {
  1: { color: "var(--success)", colorBorder: "var(--success-border)", colorSubtle: "var(--success-subtle)", label: "MINOR" },
  2: { color: "var(--warning)", colorBorder: "var(--warning-border)", colorSubtle: "var(--warning-subtle)", label: "STANDARD" },
  3: { color: "var(--danger)",  colorBorder: "var(--danger-border)",  colorSubtle: "var(--danger-subtle)",  label: "CRITICAL" },
} as const;

interface SlotProps {
  index: number;
  heroId: string | null;
  dangerColor: string;
  dangerColorSubtle: string;
  onRemove: () => void;
}

function HeroSlot({ index, heroId, dangerColor, dangerColorSubtle, onRemove }: SlotProps) {
  const { data: heroes = [] } = useHeroes();
  const hero = heroes.find((h) => h.id === heroId) ?? null;
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` });

  return (
    <div
      ref={setNodeRef}
      className="relative w-16 h-16 rounded overflow-hidden transition-all"
      style={{
        border: `1px solid ${isOver ? dangerColor : hero ? "var(--border-bright)" : "var(--border)"}`,
        backgroundColor: isOver ? "var(--panel-raised)" : "var(--panel-inset)",
        boxShadow: isOver ? `0 0 10px ${dangerColorSubtle}` : "none",
      }}
    >
      {hero ? (
        <>
          <Image src={hero.portraitUrl ?? ""} alt={hero.alias} fill sizes="64px" className="object-cover" />
          <button
            onClick={() => { sounds.slotRemove(); onRemove(); }}
            className="absolute inset-0 bg-black/0 hover:bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-all"
          >
            <span className="text-white text-sm">✕</span>
          </button>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border border-dashed" style={{ borderColor: isOver ? dangerColor : "var(--border-bright)" }} />
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

export function IncidentModal({ incident, selectedHeroIds, onHeroToggle, onClose, onDispatched }: Props) {
  function handleClose() { sounds.modalClose(); onClose(); }
  const { mutate: dispatch, isPending, error, reset: resetMutation } = useMutation({
    mutationFn: ({ incidentId, heroIds }: { incidentId: string; heroIds: string[] }) =>
      api.incidents.dispatch(incidentId, heroIds),
    onSuccess: onDispatched,
  });

  useEffect(() => {
    resetMutation();
    if (incident) sounds.modalOpen();
  }, [incident?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const danger = incident ? dangerMeta[incident.dangerLevel] : null;
  const slotCount = incident?.slotCount ?? 1;
  const canDispatch = selectedHeroIds.length >= 1 && !isPending;

  function handleDispatch() {
    if (!incident || !canDispatch) return;
    sounds.dispatch();
    dispatch({ incidentId: incident.id, heroIds: selectedHeroIds });
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
            onClick={handleClose}
          >
            {/* Panel */}
            <motion.div
              className="relative w-full max-w-xl flex flex-col overflow-hidden"
              style={{
                backgroundColor: "var(--panel)",
                border: `1px solid ${danger?.colorBorder ?? "var(--border)"}`,
                maxHeight: "min(520px, 90%)",
              }}
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Danger color top bar */}
              <div className="h-1 shrink-0" style={{ backgroundColor: danger?.color }} />

              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-[8px] tracking-widest px-2 py-0.5"
                      style={{
                        color: danger?.color,
                        backgroundColor: danger?.colorSubtle ?? "var(--border-subtle)",
                        border: `1px solid ${danger?.colorBorder ?? "var(--border)"}`
                      }}>
                      {danger?.label}
                    </span>
                  </div>
                  <h2 className="font-mono text-lg font-bold tracking-wide leading-tight" style={{ color: "var(--text-amber)" }}>
                    {incident.title.toUpperCase()}
                  </h2>
                </div>
                <button onClick={handleClose} className="font-mono text-xs shrink-0 mt-1 transition-opacity hover:opacity-100"
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
                    <div className="font-mono text-[9px] tracking-widest mb-2.5" style={{ color: "var(--text-muted)" }}>
                      FIELD INTEL
                    </div>
                    <div style={{ backgroundColor: "var(--panel-inset)", border: "1px solid var(--border-subtle)", padding: "12px" }}>
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
                      dangerColor={danger?.color ?? "var(--border)"}
                      dangerColorSubtle={danger?.colorSubtle ?? "var(--border-subtle)"}
                      onRemove={() => onHeroToggle(selectedHeroIds[i])}
                    />
                  ))}
                </div>
                {error && (
                  <div className="font-mono text-[10px]" style={{ color: "var(--danger)" }}>
                    {error instanceof Error ? error.message : "Dispatch failed"}
                  </div>
                )}
                {canDispatch ? (
                  <ShimmerButton
                    onClick={handleDispatch}
                    className="w-full max-w-xs py-2.5 font-mono text-xs tracking-widest uppercase text-black"
                    background={danger?.color ?? "var(--success)"}
                    borderRadius="0px"
                    shimmerColor="rgba(255,255,255,0.25)"
                  >
                    {isPending ? "Dispatching..." : "Dispatch"}
                  </ShimmerButton>
                ) : (
                  <button
                    disabled
                    className="w-full max-w-xs py-2.5 font-mono text-xs tracking-widest uppercase"
                    style={{ backgroundColor: "var(--border)", color: "var(--text-muted)", cursor: "not-allowed" }}
                  >
                    Dispatch
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
