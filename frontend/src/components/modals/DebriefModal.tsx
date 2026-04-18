"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { MissionOutcomeState } from "@/stores/gameStore";
import { useDebrief } from "@/hooks/useDebrief";
import { api } from "@/api";
import { sounds } from "@/sounds";

const verdictMeta = {
  optimal:    { color: "var(--success)", colorSubtle: "var(--success-subtle)", colorBorder: "var(--success-border)", label: "OPTIMAL" },
  good:       { color: "var(--success)", colorSubtle: "var(--success-subtle)", colorBorder: "var(--success-border)", label: "GOOD" },
  suboptimal: { color: "var(--warning)", colorSubtle: "var(--warning-subtle)", colorBorder: "var(--warning-border)", label: "SUBOPTIMAL" },
  poor:       { color: "var(--danger)",  colorSubtle: "var(--danger-subtle)",  colorBorder: "var(--danger-border)",  label: "POOR" },
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActiveHeroIdx(0); }, [incidentId]);
  useEffect(() => { if (outcome && incidentId) sounds.modalOpen(); }, [incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAck() {
    if (!incidentId) return;
    sounds.modalClose();
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
              border: `1px solid ${isSuccess ? "var(--success-subtle)" : "var(--danger-subtle)"}`,
              maxHeight: "88vh",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 shrink-0" style={{ backgroundColor: isSuccess ? "var(--success)" : "var(--danger)" }} />

            <div className="flex items-start justify-between gap-3 p-5 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="vg-chip" style={{ color: isSuccess ? "var(--success)" : "var(--danger)" }}>
                    <span className="vg-pip" />
                    MISSION {isSuccess ? "SUCCESS" : "FAILURE"} · DEBRIEF
                  </span>
                </div>
                <h2
                  className="text-[19px] leading-tight"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    color: "var(--text-amber)",
                    textTransform: "uppercase",
                  }}
                >
                  {outcome.title}
                </h2>
              </div>
              <button
                onClick={handleAck}
                className="font-mono text-xs mt-1 shrink-0 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {verdict && outcome.evalScore != null && (
              <div
                className="mx-5 mb-4 px-4 py-3 flex items-center gap-4 shrink-0"
                style={{ backgroundColor: "var(--panel-raised)", border: "1px solid var(--border)" }}
              >
                <div className="flex flex-col items-center shrink-0">
                  <span
                    className="text-3xl leading-none"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      color: verdict.color,
                      textShadow: `0 0 20px ${verdict.color}60`,
                    }}
                  >
                    {outcome.evalScore}
                  </span>
                  <span
                    className="font-mono text-[9px] tracking-widest px-2 py-0.5 mt-1"
                    style={{ color: verdict.color, backgroundColor: verdict.colorSubtle, border: `1px solid ${verdict.colorBorder}` }}
                  >
                    {verdict.label}
                  </span>
                </div>
                <div
                  className="flex flex-col flex-1 min-w-0 pl-4"
                  style={{ borderLeft: "1px solid var(--border)" }}
                >
                  <span className="vg-caps mb-1.5" style={{ color: "var(--text-muted)" }}>
                    DISPATCH ANALYSIS
                  </span>
                  {outcome.evalPostOpNote && (
                    <p
                      className="text-[13px] leading-relaxed"
                      style={{
                        fontFamily: "var(--font-serif)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {outcome.evalPostOpNote}
                    </p>
                  )}
                </div>
              </div>
            )}

            {heroes.length > 0 && (
              <div className="flex-1 flex flex-col overflow-hidden">
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

                {activeHero && (
                  <div
                    className="flex-1 mx-5 mb-4 overflow-y-auto"
                    style={{ border: "1px solid var(--border)", backgroundColor: "var(--panel-raised)" }}
                  >
                    <div className="flex gap-4 p-4">
                      {activeHero.portraitUrl && (
                        <div
                          className="relative w-20 h-20 shrink-0 overflow-hidden"
                          style={{ border: `1px solid ${isSuccess ? "var(--success-subtle)" : "var(--danger-subtle)"}` }}
                        >
                          <Image src={activeHero.portraitUrl} alt={activeHero.alias} fill sizes="80px" className="object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {activeHero.report ? (
                          <p
                            className="text-[13px] leading-relaxed"
                            style={{
                              fontFamily: "var(--font-serif)",
                              color: "var(--text-primary)",
                            }}
                          >
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

            <div className="px-5 py-3 shrink-0 text-center" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="vg-caps" style={{ color: "var(--text-muted)" }}>
                CLICK ANYWHERE TO DISMISS
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
