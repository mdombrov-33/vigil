"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { MissionOutcomeState } from "@/stores/gameStore";
import { useDebrief } from "@/hooks/useDebrief";
import { api } from "@/lib/api";

const verdictMeta = {
  optimal:    { color: "#22c55e", label: "OPTIMAL" },
  good:       { color: "#86efac", label: "GOOD" },
  suboptimal: { color: "#eab308", label: "SUBOPTIMAL" },
  poor:       { color: "#ef4444", label: "POOR" },
} as const;

interface Props {
  outcome: MissionOutcomeState | null;
  incidentId: string | null;
  onClose: () => void;
}

export function DebriefModal({ outcome, incidentId, onClose }: Props) {
  const [activeHeroIdx, setActiveHeroIdx] = useState(0);
  const { data } = useDebrief(incidentId);
  const heroes = data?.heroes ?? [];

  useEffect(() => { setActiveHeroIdx(0); }, [incidentId]);

  function handleAck() {
    if (!incidentId) return;
    api.incidents.acknowledge(incidentId);
    onClose();
  }

  const isSuccess = outcome?.outcome != null && outcome.outcome === "success";
  const verdict = outcome?.evalVerdict ? verdictMeta[outcome.evalVerdict] : null;
  const activeHero = heroes[activeHeroIdx] ?? null;

  return (
    <AnimatePresence>
      {outcome && incidentId && (
        <motion.div
          className="absolute inset-0 z-20 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleAck}
        >
          <motion.div
            className="relative w-full max-w-lg flex flex-col overflow-hidden"
            style={{
              backgroundColor: "var(--panel)",
              border: `1px solid ${isSuccess ? "#22c55e25" : "#ef444425"}`,
              maxHeight: "88vh",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Outcome top bar */}
            <div className="h-0.5 shrink-0" style={{ backgroundColor: isSuccess ? "var(--success)" : "var(--danger)" }} />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isSuccess ? "var(--success)" : "var(--danger)", boxShadow: `0 0 6px ${isSuccess ? "#22c55e" : "#ef4444"}` }} />
                  <span className="font-mono text-[9px] tracking-widest"
                    style={{ color: isSuccess ? "var(--success)" : "var(--danger)" }}>
                    MISSION {isSuccess ? "SUCCESS" : "FAILURE"} — DEBRIEF
                  </span>
                </div>
                <h2 className="font-mono text-lg font-bold tracking-wide" style={{ color: "var(--text-amber)" }}>
                  {outcome.title.toUpperCase()}
                </h2>
              </div>
              <button onClick={handleAck} className="font-mono text-xs mt-1 shrink-0 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            {/* Dispatch analysis row */}
            {verdict && outcome.evalScore != null && (
              <div className="mx-5 mb-4 px-4 py-3 flex items-center gap-4 shrink-0"
                style={{ backgroundColor: "var(--panel-raised)", border: "1px solid var(--border)" }}>
                <div className="flex flex-col items-center shrink-0">
                  <span className="font-mono text-2xl font-bold leading-none" style={{ color: verdict.color }}>
                    {outcome.evalScore}
                  </span>
                  <span className="font-mono text-[8px] tracking-widest mt-0.5" style={{ color: verdict.color }}>
                    {verdict.label}
                  </span>
                </div>
                <div className="flex flex-col flex-1 min-w-0 pl-4" style={{ borderLeft: "1px solid var(--border)" }}>
                  <span className="font-mono text-[9px] tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                    DISPATCH ANALYSIS — hero selection vs. incident demands
                  </span>
                  {outcome.evalPostOpNote && (
                    <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                      {outcome.evalPostOpNote}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Hero reports */}
            {heroes.length > 0 && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Hero tabs */}
                {heroes.length > 1 && (
                  <div className="flex gap-0 shrink-0 mx-5 mb-3">
                    {heroes.map((h, i) => (
                      <button
                        key={h.heroId}
                        onClick={() => setActiveHeroIdx(i)}
                        className="flex items-center gap-2 px-3 py-1.5 font-mono text-[9px] tracking-widest transition-colors"
                        style={{
                          backgroundColor: i === activeHeroIdx ? "var(--panel-raised)" : "transparent",
                          border: "1px solid var(--border)",
                          borderBottom: i === activeHeroIdx ? "1px solid var(--panel-raised)" : "1px solid var(--border)",
                          color: i === activeHeroIdx ? "var(--text-amber)" : "var(--text-secondary)",
                          marginRight: -1,
                        }}
                      >
                        {h.alias.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}

                {/* Active hero report */}
                {activeHero && (
                  <div className="flex-1 mx-5 mb-4 overflow-y-auto"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--panel-raised)" }}>
                    <div className="flex gap-4 p-4">
                      {activeHero.portraitUrl && (
                        <div className="relative w-20 h-20 shrink-0 rounded overflow-hidden"
                          style={{ border: `1px solid ${isSuccess ? "#22c55e30" : "#ef444430"}` }}>
                          <Image src={activeHero.portraitUrl} alt={activeHero.alias} fill sizes="80px" className="object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[9px] tracking-widest mb-2" style={{ color: "var(--text-secondary)" }}>
                          {activeHero.alias.toUpperCase()} — FIELD REPORT
                        </div>
                        {activeHero.report ? (
                          <p className="font-mono text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
                            {activeHero.report}
                          </p>
                        ) : (
                          <p className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                            Report pending...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dismiss hint */}
            <div className="px-5 py-3 shrink-0 text-center" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                CLICK ANYWHERE TO DISMISS
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
