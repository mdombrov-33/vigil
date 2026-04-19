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
      className="relative w-16 h-16 overflow-hidden transition-all"
      style={{
        border: `1px solid ${isOver ? dangerColor : hero ? "var(--border-bright)" : "var(--border)"}`,
        backgroundColor: isOver ? "var(--panel-raised)" : "var(--panel-inset)",
        boxShadow: isOver ? `0 0 10px ${dangerColorSubtle}` : "none",
      }}
    >
      {hero ? (
        <>
          <Image src={hero.portraitUrl ?? ""} alt={hero.alias} fill sizes="64px" className="object-cover" />
          <div
            className="absolute left-0 right-0 bottom-0 text-center font-mono text-[8px] tracking-widest py-0.5"
            style={{
              color: "var(--text-hi)",
              background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)",
            }}
          >
            {hero.alias.toUpperCase()}
          </div>
          <button
            onClick={() => { sounds.slotRemove(); onRemove(); }}
            className="absolute inset-0 bg-black/0 hover:bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-all"
            aria-label={`Remove ${hero.alias}`}
          >
            <span className="text-white text-sm">✕</span>
          </button>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isOver ? dangerColor : "var(--border-bright)" }}
          />
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

function formatTimeCode(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `[${hh}:${mm}:${ss}]`;
  } catch {
    return "[--:--:--]";
  }
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
        <motion.div
          className="absolute inset-0 z-20 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="relative w-full max-w-xl flex flex-col overflow-hidden"
            style={{
              backgroundColor: "var(--panel)",
              border: `1px solid ${danger?.colorBorder ?? "var(--border)"}`,
              maxHeight: "min(680px, 92%)",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 shrink-0" style={{ backgroundColor: danger?.color }} />

            <div className="px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="vg-chip"
                      style={{ color: danger?.color }}
                    >
                      <span className="vg-pip" />
                      {danger?.label}
                    </span>
                    <span className="vg-time-code">{formatTimeCode(incident.createdAt)}</span>
                  </div>
                  <h2
                    className="text-[20px] leading-tight"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      letterSpacing: "0.01em",
                      color: "var(--text-amber)",
                      textTransform: "uppercase",
                    }}
                  >
                    {incident.title}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="font-mono text-xs shrink-0 mt-1 transition-opacity hover:opacity-100"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
              <div
                className={
                  incident.hints.length > 0
                    ? "grid gap-5 grid-cols-1 md:grid-cols-[1fr_1px_1fr]"
                    : "grid gap-5 grid-cols-1"
                }
              >
                <p
                  className="text-[14px] leading-relaxed"
                  style={{
                    fontFamily: "var(--font-serif)",
                    color: "var(--text-primary)",
                  }}
                >
                  {incident.description}
                </p>

                {incident.hints.length > 0 && (
                  <>
                    <div
                      className="h-px md:h-auto md:w-px"
                      style={{ backgroundColor: "var(--border-subtle)" }}
                    />
                    <div>
                      <div className="vg-caps mb-2.5">FIELD INTEL</div>
                      <ul className="flex flex-col gap-2">
                        {incident.hints.map((hint, i) => (
                          <li key={i} className="flex gap-2 items-start">
                            <span className="vg-mark" style={{ color: danger?.color }}>▸</span>
                            <span
                              className="text-[12px] leading-relaxed"
                              style={{
                                fontFamily: "var(--font-geist-mono)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {hint}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              className="shrink-0 px-5 py-4 flex flex-col items-center gap-3"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div className="vg-caps">
                {selectedHeroIds.length === 0
                  ? "SELECT HEROES FROM ROSTER"
                  : `${selectedHeroIds.length} / ${slotCount} SELECTED`}
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
      )}
    </AnimatePresence>
  );
}
