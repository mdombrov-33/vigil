"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { useGameStore } from "@/stores/gameStore";
import { api } from "@/api";
import { sounds } from "@/sounds";
import type { RollResult } from "@/types/api";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";

const STAT_KEYS = ["threat", "grit", "presence", "edge", "tempo"] as const;
const STAT_LABELS: Record<string, string> = {
  threat: "THR",
  grit: "GRT",
  presence: "PRS",
  edge: "EDG",
  tempo: "TMP",
};

interface Props {
  incidentId: string | null;
  onClose: () => void;
}

export function RollRevealModal({ incidentId, onClose }: Props) {
  const [rollData, setRollData] = useState<RollResult | null>(null);
  const [showRoll, setShowRoll] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confettiRef = useRef<ConfettiRef>(null);
  const setOutcomeRevealed = useGameStore((s) => s.setOutcomeRevealed);
  const missionOutcomes = useGameStore((s) => s.missionOutcomes);

  const title = incidentId ? (missionOutcomes[incidentId]?.title ?? "") : "";

  useEffect(() => {
    if (!incidentId) return;
    let cancelled = false;
    api.incidents.roll(incidentId)
      .then((result) => {
        if (cancelled) return;
        setRollData(result);
        setOutcomeRevealed(
          incidentId,
          result.outcome,
          result.roll,
          result.requiredStats,
          result.dispatchedStats,
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load roll data");
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId]);

  useEffect(() => {
    if (!rollData) return;
    const t1 = setTimeout(() => { setShowRoll(true); sounds.rollSpin(); }, 800);
    return () => clearTimeout(t1);
  }, [rollData]);

  useEffect(() => {
    if (!showRoll || !rollData) return;
    const t = setTimeout(() => {
      setShowResult(true);
      sounds.rollLand();
      if (rollData.outcome === "failure") sounds.failure();
      if (rollData.outcome === "success") {
        confettiRef.current?.fire({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.55 },
          colors: ["#1ecc6a", "#f0a800", "#3a90ff", "#9a70f0"],
          gravity: 1.2,
          scalar: 0.9,
        });
      }
    }, 1400);
    return () => clearTimeout(t);
  }, [showRoll, rollData]);

  const isOpen = incidentId !== null;

  if (!isOpen) return null;

  const requiredStats = rollData?.requiredStats ?? {};
  const dispatchedStats = rollData?.dispatchedStats ?? {};
  const roll = rollData?.roll ?? 0.5;

  const radarData = STAT_KEYS.map((key) => ({
    stat: STAT_LABELS[key],
    required: (requiredStats[key] ?? 0) > 0 ? requiredStats[key]! : 0.01,
    dispatched: dispatchedStats[key] ?? 0,
  }));

  const reqKeys = STAT_KEYS.filter((k) => (requiredStats[k] ?? 0) > 0);
  const perStat = reqKeys.map((k) =>
    Math.min((dispatchedStats[k] ?? 0) / requiredStats[k]!, 1.0),
  );
  const coverage =
    perStat.length > 0
      ? perStat.reduce((a, b) => a + b, 0) / perStat.length
      : 0;
  const successChance = coverage ** 2;

  const isSuccess = rollData?.outcome === "success";
  const outcomeColor = isSuccess ? "var(--success)" : "var(--danger)";
  const thresholdPct = successChance * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-20 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={showResult ? onClose : undefined}
        >
          <Confetti
            ref={confettiRef}
            manualstart
            className="pointer-events-none absolute inset-0 z-50 w-full h-full"
          />
          <motion.div
            className="relative w-full max-w-sm flex flex-col overflow-hidden"
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="min-w-0">
                <div className="vg-caps mb-1.5" style={{ color: "var(--text-muted)" }}>ROLL REVEAL</div>
                <h2
                  className="text-[17px] leading-tight"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    color: "var(--text-amber)",
                    textTransform: "uppercase",
                  }}
                >
                  {title}
                </h2>
              </div>
              {showResult && (
                <button
                  onClick={onClose}
                  className="font-mono text-xs hover:opacity-100 transition-opacity shrink-0 mt-1"
                  style={{ color: "var(--text-muted)" }}
                  aria-label="Close"
                >
                  ✕
                </button>
              )}
            </div>

            {error ? (
              <div className="px-5 py-8 text-center font-mono text-[11px]" style={{ color: "var(--danger)" }}>
                {error}
              </div>
            ) : !rollData ? (
              <div className="px-5 py-8 text-center font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>
                LOADING...
              </div>
            ) : (
              <>
                <div
                  className="px-2"
                  style={{ height: 220, pointerEvents: "none" }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="72%">
                      <PolarGrid stroke="#ffffff12" />
                      <PolarAngleAxis
                        dataKey="stat"
                        tick={{
                          fill: "#6a5e48",
                          fontSize: 10,
                          fontFamily: "monospace",
                        }}
                      />
                      <Radar
                        name="Required"
                        dataKey="required"
                        stroke="var(--warning)"
                        fill="var(--warning)"
                        fillOpacity={0.12}
                        strokeWidth={1.5}
                        isAnimationActive
                        animationBegin={0}
                        animationDuration={700}
                      />
                      <Radar
                        name="Dispatched"
                        dataKey="dispatched"
                        stroke="var(--info)"
                        fill="var(--info)"
                        fillOpacity={0.22}
                        strokeWidth={1.5}
                        isAnimationActive
                        animationBegin={200}
                        animationDuration={700}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex justify-center gap-5 pb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-px" style={{ backgroundColor: "var(--warning)" }} />
                    <span className="vg-caps" style={{ color: "var(--warning)" }}>REQUIRED</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-px" style={{ backgroundColor: "var(--info)" }} />
                    <span className="vg-caps" style={{ color: "var(--info)" }}>DISPATCHED</span>
                  </div>
                </div>

                <div className="px-5 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex justify-between mt-3 mb-1.5">
                    <span className="vg-caps" style={{ color: "var(--success)" }}>
                      ← SUCCESS ({Math.round(successChance * 100)}%)
                    </span>
                    <span className="vg-caps" style={{ color: "var(--danger)" }}>
                      FAILURE ({Math.round((1 - successChance) * 100)}%) →
                    </span>
                  </div>

                  <div className="relative h-4 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <div
                      className="absolute left-0 top-0 h-full"
                      style={{ width: `${thresholdPct}%`, backgroundColor: "color-mix(in srgb, var(--success) 22%, transparent)" }}
                    />
                    <div
                      className="absolute top-0 h-full"
                      style={{ left: `${thresholdPct}%`, right: 0, backgroundColor: "color-mix(in srgb, var(--danger) 22%, transparent)" }}
                    />
                    <div
                      className="absolute top-0 h-full"
                      style={{ left: `${thresholdPct}%`, width: 1, backgroundColor: "#ffffff20" }}
                    />
                    {showRoll && (
                      <motion.div
                        className="absolute top-0 h-full"
                        style={{ width: 2, marginLeft: -1 }}
                        initial={{ left: "0%" }}
                        animate={{ left: `${roll * 100}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                      >
                        <div
                          className="w-full h-full"
                          style={{
                            backgroundColor: showResult ? outcomeColor : "var(--text-amber)",
                            boxShadow: `0 0 6px ${showResult ? outcomeColor : "var(--text-amber)"}`,
                            transition: "background-color 0.3s, box-shadow 0.3s",
                          }}
                        />
                      </motion.div>
                    )}
                  </div>

                  <div className="mt-4 min-h-10 flex items-center justify-center">
                    {showResult && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25 }}
                        className="px-4 py-1.5"
                        style={{
                          border: `1px solid ${outcomeColor}`,
                          color: outcomeColor,
                          fontFamily: "var(--font-display)",
                          fontWeight: 700,
                          fontSize: 22,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          textShadow: `0 0 14px ${outcomeColor}55`,
                          background: `color-mix(in srgb, ${outcomeColor} 10%, transparent)`,
                        }}
                      >
                        {isSuccess ? "SUCCESS" : "FAILURE"}
                      </motion.div>
                    )}
                  </div>
                </div>

                {showResult && (
                  <div
                    className="px-5 py-2.5 shrink-0 text-center"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <span className="vg-caps" style={{ color: "var(--text-muted)" }}>
                      CLICK ANYWHERE TO DISMISS
                    </span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
