"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { api } from "@/api";
import { InterruptOptionRow } from "./InterruptOptionRow";
import type { InterruptOption } from "@/types/api";

// Auto-close delay after resolution animation plays
const RESOLVE_AUTOCLOSE_MS = 7000;

interface Props {
  onClose: () => void;
}

export function InterruptModal({ onClose }: Props) {
  const interruptState = useGameStore((s) => s.interruptState);
  const clearInterrupt = useGameStore((s) => s.clearInterrupt);
  const incidents = useGameStore((s) => s.incidents);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const incident =
    incidents.find((i) => i.id === interruptState?.incidentId) ?? null;
  const isResolved = !!interruptState?.resolved;
  const confirmedChoiceId =
    interruptState?.resolved?.chosenOptionId ?? submittedId;
  const resolvedOutcome = interruptState?.resolved?.outcome ?? null;
  const resolvedCombinedValue = interruptState?.resolved?.combinedValue ?? null;
  const displayOptions: InterruptOption[] = isResolved
    ? (interruptState?.resolved?.options ?? [])
    : (interruptState?.options ?? []);

  // Auto-close after resolution animation plays out
  useEffect(() => {
    if (!isResolved) return;
    const timer = setTimeout(
      () => handleCloseAfterResolution(),
      RESOLVE_AUTOCLOSE_MS,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResolved]);

  async function handleSelect(optionId: string) {
    if (submittedId || isResolved || !interruptState) return;
    setSubmittedId(optionId);
    setError(null);
    try {
      await api.incidents.interrupt(interruptState.incidentId, optionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmittedId(null);
    }
  }

  function handleClose() {
    setSubmittedId(null);
    setError(null);
    onClose();
  }

  function handleCloseAfterResolution() {
    clearInterrupt();
    setSubmittedId(null);
    setError(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {interruptState && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className={`relative w-full max-w-md flex flex-col overflow-hidden${!isResolved ? " danger-glow" : ""}`}
            style={{
              backgroundColor: "var(--panel)",
              border: `1px solid ${isResolved ? "#ff2c4425" : "#ff2c4470"}`,
              maxHeight: "85vh",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
          >
            {/* Corner brackets */}
            {!isResolved && (
              <>
                <span
                  className="bracket-pulse absolute pointer-events-none"
                  style={{
                    top: 6,
                    left: 6,
                    width: 12,
                    height: 12,
                    borderTop: "1.5px solid #ff2c44",
                    borderLeft: "1.5px solid #ff2c44",
                  }}
                />
                <span
                  className="bracket-pulse absolute pointer-events-none"
                  style={{
                    top: 6,
                    right: 6,
                    width: 12,
                    height: 12,
                    borderTop: "1.5px solid #ff2c44",
                    borderRight: "1.5px solid #ff2c44",
                  }}
                />
                <span
                  className="bracket-pulse absolute pointer-events-none"
                  style={{
                    bottom: 6,
                    left: 6,
                    width: 12,
                    height: 12,
                    borderBottom: "1.5px solid #ff2c44",
                    borderLeft: "1.5px solid #ff2c44",
                  }}
                />
                <span
                  className="bracket-pulse absolute pointer-events-none"
                  style={{
                    bottom: 6,
                    right: 6,
                    width: 12,
                    height: 12,
                    borderBottom: "1.5px solid #ff2c44",
                    borderRight: "1.5px solid #ff2c44",
                  }}
                />
              </>
            )}

            <div
              className="h-1 shrink-0"
              style={{
                backgroundColor: isResolved ? "#ff2c4440" : "var(--danger)",
              }}
            />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="font-mono text-[9px] tracking-widest"
                    style={{
                      color: isResolved ? "var(--text-muted)" : "var(--danger)",
                    }}
                  >
                    {isResolved
                      ? "DECISION RECORDED"
                      : "INTERRUPT — DECISION REQUIRED"}
                  </span>
                </div>
                <h2
                  className="font-mono text-lg font-bold tracking-wide"
                  style={{ color: "var(--text-amber)" }}
                >
                  {incident?.title.toUpperCase() ?? "MISSION CRITICAL"}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="font-mono text-xs mt-1 shrink-0 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="px-5 pb-3 shrink-0 flex flex-col gap-2">
              {interruptState.trigger && !isResolved && (
                <p
                  className="font-mono text-[11px] leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                >
                  {interruptState.trigger}
                </p>
              )}
              <p
                className="font-mono text-[9px] tracking-widest uppercase"
                style={{ color: "var(--text-secondary)" }}
              >
                {isResolved
                  ? "Stat data revealed — closing shortly"
                  : submittedId
                    ? "Awaiting response..."
                    : "Select an approach"}
              </p>
            </div>

            {/* Options */}
            <div className="flex-1 px-5 flex flex-col gap-2 overflow-y-auto pb-4">
              {displayOptions.map((option, i) => (
                <InterruptOptionRow
                  key={option.id}
                  option={option}
                  index={i}
                  isSubmitting={!!submittedId && !isResolved}
                  isResolved={isResolved}
                  isChosen={confirmedChoiceId === option.id}
                  topHeroId={interruptState.topHeroId}
                  heroIds={interruptState.heroIds}
                  resolvedOutcome={
                    confirmedChoiceId === option.id ? resolvedOutcome : null
                  }
                  resolvedCombinedValue={
                    confirmedChoiceId === option.id
                      ? resolvedCombinedValue
                      : null
                  }
                  onSelect={() => handleSelect(option.id)}
                />
              ))}
              {error && (
                <div
                  className="font-mono text-[10px] mt-1"
                  style={{ color: "var(--danger)" }}
                >
                  {error}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
