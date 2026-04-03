"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { MissionOutcomeState } from "@/stores/gameStore";
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
  outcome: MissionOutcomeState | null;
  onClose: () => void;
}

export function RollRevealModal({ outcome, onClose }: Props) {
  const [showRoll, setShowRoll] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const confettiRef = useRef<ConfettiRef>(null);

  useEffect(() => {
    if (!outcome) return;
    const t1 = setTimeout(() => setShowRoll(true), 800);
    return () => clearTimeout(t1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showRoll) return;
    const t = setTimeout(() => {
      setShowResult(true);
      if (outcome?.outcome === "success") {
        confettiRef.current?.fire({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.55 },
          colors: ["#22c55e", "#fbbf24", "#3b82f6", "#a78bfa"],
          gravity: 1.2,
          scalar: 0.9,
        });
      }
    }, 1400);
    return () => clearTimeout(t);
  }, [showRoll, outcome?.outcome]);

  const isOpen = outcome !== null;

  if (!outcome) return null;

  const { requiredStats = {}, dispatchedStats = {} } = outcome;
  const roll = outcome.roll ?? 0.5;

  const radarData = STAT_KEYS.map((key) => ({
    stat: STAT_LABELS[key],
    required: requiredStats[key] ?? 0,
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

  const isSuccess = outcome.outcome === "success";
  const outcomeColor = isSuccess ? "#22c55e" : "#ef4444";
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
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
              <span
                className="font-mono text-[9px] tracking-widest"
                style={{ color: "var(--text-amber)" }}
              >
                {outcome.title.toUpperCase()}
              </span>
              {showResult && (
                <button
                  onClick={onClose}
                  className="font-mono text-xs hover:opacity-100 transition-opacity"
                  style={{ color: "var(--text-muted)" }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Radar chart */}
            <div
              className="px-2"
              style={{ height: 220, pointerEvents: "none" }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#ffffff0d" />
                  <PolarAngleAxis
                    dataKey="stat"
                    tick={{
                      fill: "#6b7280",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  />
                  <Radar
                    name="Required"
                    dataKey="required"
                    stroke="#f97316"
                    fill="#f97316"
                    fillOpacity={0.12}
                    strokeWidth={1.5}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={700}
                  />
                  <Radar
                    name="Dispatched"
                    dataKey="dispatched"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.22}
                    strokeWidth={1.5}
                    isAnimationActive
                    animationBegin={200}
                    animationDuration={700}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-5 pb-3">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-px"
                  style={{ backgroundColor: "#f97316" }}
                />
                <span
                  className="font-mono text-[8px] tracking-widest"
                  style={{ color: "#f97316" }}
                >
                  REQUIRED
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-3 h-px"
                  style={{ backgroundColor: "#3b82f6" }}
                />
                <span
                  className="font-mono text-[8px] tracking-widest"
                  style={{ color: "#3b82f6" }}
                >
                  DISPATCHED
                </span>
              </div>
            </div>

            {/* Roll bar */}
            <div
              className="px-5 pb-4"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div className="flex justify-between mt-3 mb-1.5">
                <span
                  className="font-mono text-[8px] tracking-widest"
                  style={{ color: "#22c55e80" }}
                >
                  ← SUCCESS ({Math.round(successChance * 100)}%)
                </span>
                <span
                  className="font-mono text-[8px] tracking-widest"
                  style={{ color: "#ef444480" }}
                >
                  FAILURE ({Math.round((1 - successChance) * 100)}%) →
                </span>
              </div>

              <div
                className="relative h-4 overflow-hidden"
                style={{ border: "1px solid var(--border)" }}
              >
                {/* Success zone (left) */}
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: `${thresholdPct}%`,
                    backgroundColor: "#22c55e18",
                  }}
                />
                {/* Failure zone (right) */}
                <div
                  className="absolute top-0 h-full"
                  style={{
                    left: `${thresholdPct}%`,
                    right: 0,
                    backgroundColor: "#ef444418",
                  }}
                />
                {/* Threshold divider */}
                <div
                  className="absolute top-0 h-full"
                  style={{
                    left: `${thresholdPct}%`,
                    width: 1,
                    backgroundColor: "#ffffff20",
                  }}
                />
                {/* Cursor */}
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
                        backgroundColor: showResult ? outcomeColor : "#fbbf24",
                        boxShadow: `0 0 6px ${showResult ? outcomeColor : "#fbbf24"}`,
                        transition: "background-color 0.3s, box-shadow 0.3s",
                      }}
                    />
                  </motion.div>
                )}
              </div>

              {/* Outcome badge */}
              <div className="mt-3 min-h-6 flex items-center justify-center">
                {showResult && (
                  <motion.span
                    className="font-mono text-sm font-bold tracking-widest"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      color: outcomeColor,
                      textShadow: `0 0 16px ${outcomeColor}50`,
                    }}
                  >
                    {isSuccess ? "SUCCESS" : "FAILURE"}
                  </motion.span>
                )}
              </div>
            </div>

            {/* Dismiss hint */}
            {showResult && (
              <div
                className="px-5 py-2.5 shrink-0 text-center"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span
                  className="font-mono text-[9px] tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  CLICK ANYWHERE TO DISMISS
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
