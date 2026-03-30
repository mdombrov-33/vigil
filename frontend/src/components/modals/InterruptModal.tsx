"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useGameStore } from "@/stores/gameStore";
import { useHeroes } from "@/hooks/useHeroes";
import type { InterruptOption } from "@/types/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const statLabel: Record<string, string> = {
  threat: "THR", grit: "GRT", presence: "PRS", edge: "EDG", tempo: "TMP",
};

interface Props { onClose: () => void; }

async function submitChoice(incidentId: string, choiceId: string) {
  const res = await fetch(`${API}/api/v1/incidents/${incidentId}/interrupt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choiceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed");
  }
}

function OptionRow({
  option, isSelected, isConfirmed, isResolved, isChosen, topHeroId, heroIds, onSelect,
}: {
  option: InterruptOption; isSelected: boolean; isConfirmed: boolean;
  isResolved: boolean; isChosen: boolean;
  topHeroId: string | null; heroIds: string[]; onSelect: () => void;
}) {
  const { data: heroes = [] } = useHeroes();
  const topHero = heroes.find((h) => h.id === topHeroId) ?? null;
  const topHeroDispatched = topHeroId != null && heroIds.includes(topHeroId);
  const isLocked = option.isHeroSpecific && !topHeroDispatched;

  // Locked option — show compact locked row instead of full option
  if (isLocked && !isResolved) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ border: "1px solid #1a1a2a", backgroundColor: "#0a0a10" }}
      >
        <div className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center"
          style={{ borderColor: "#2a2a40" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#2a2a40" }} />
        </div>
        {topHero?.portraitUrl && (
          <div className="relative w-7 h-7 shrink-0 rounded overflow-hidden grayscale opacity-30">
            <Image src={topHero.portraitUrl} alt={topHero.alias} fill sizes="28px" className="object-cover" />
          </div>
        )}
        <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
          LOCKED — {topHero?.alias ?? "Hero"} not deployed
        </span>
      </div>
    );
  }

  const isDisabled = isConfirmed || isLocked;
  const borderColor = isChosen ? "#fbbf24" : isSelected ? "#fbbf2460" : "var(--border)";
  const bgColor = isChosen ? "#fbbf2412" : isSelected ? "#fbbf2408" : "var(--panel-raised)";

  return (
    <motion.button
      onClick={!isDisabled ? onSelect : undefined}
      disabled={isDisabled}
      className="w-full text-left flex items-center gap-3 p-4 transition-colors relative"
      style={{ border: `1px solid ${borderColor}`, backgroundColor: bgColor, cursor: isDisabled ? "default" : "pointer" }}
      whileHover={!isDisabled ? { borderColor: "#fbbf2450" } : {}}
      whileTap={!isDisabled ? { scale: 0.99 } : {}}
    >
      {/* Left accent */}
      <AnimatePresence>
        {(isSelected || isChosen) && (
          <motion.div className="absolute left-0 top-0 bottom-0 w-0.5"
            style={{ backgroundColor: "#fbbf24" }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
            transition={{ duration: 0.12 }} />
        )}
      </AnimatePresence>

      {/* Radio circle */}
      <div className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center"
        style={{ borderColor: isChosen || isSelected ? "#fbbf24" : "#404060" }}>
        {(isSelected || isChosen) && (
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#fbbf24" }} />
        )}
      </div>

      {/* Portrait for hero-specific */}
      {option.isHeroSpecific && topHero?.portraitUrl && (
        <div className="relative w-9 h-9 shrink-0 rounded overflow-hidden">
          <Image src={topHero.portraitUrl} alt={topHero.alias} fill sizes="36px" className="object-cover" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {option.text}
        </p>
        {isResolved && (option.statKey || option.isHeroSpecific) && (
          <motion.span
            className="inline-block font-mono text-[9px] tracking-widest px-1.5 py-0.5 mt-2"
            style={{ backgroundColor: "var(--border)", color: "var(--text-amber)" }}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.3 }}
          >
            {option.isHeroSpecific
              ? `HERO: ${topHero?.alias ?? "?"}`
              : `${statLabel[option.statKey!] ?? option.statKey?.toUpperCase()} ≥ ${option.requiredValue}`}
          </motion.span>
        )}
      </div>

      {isChosen && (
        <span className="font-mono text-[9px] tracking-widest shrink-0" style={{ color: "var(--text-amber)" }}>
          CHOSEN
        </span>
      )}
    </motion.button>
  );
}

export function InterruptModal({ onClose }: Props) {
  const interruptState = useGameStore((s) => s.interruptState);
  const clearInterrupt = useGameStore((s) => s.clearInterrupt);
  const incidents = useGameStore((s) => s.incidents);
  const [pendingChoiceId, setPendingChoiceId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const incident = incidents.find((i) => i.id === interruptState?.incidentId) ?? null;
  const isResolved = !!interruptState?.resolved;
  const confirmedChoiceId = interruptState?.resolved?.chosenOptionId ?? null;
  const displayOptions: InterruptOption[] = isResolved
    ? (interruptState?.resolved?.options ?? [])
    : (interruptState?.options ?? []);

  function handleSelect(optionId: string) {
    if (submitting || isResolved) return;
    setPendingChoiceId((prev) => (prev === optionId ? null : optionId));
  }

  async function handleConfirm() {
    if (!interruptState || !pendingChoiceId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitChoice(interruptState.incidentId, pendingChoiceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmitting(false);
    }
  }

  function handleClose() {
    clearInterrupt();
    setPendingChoiceId(null);
    setError(null);
    onClose();
  }

  return (
    <AnimatePresence>
      {interruptState && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center p-6"
          style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md flex flex-col overflow-hidden"
            style={{
              backgroundColor: "var(--panel)",
              border: "1px solid #ef444430",
              maxHeight: "85vh",
            }}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
          >
            <div className="h-0.5 shrink-0" style={{ backgroundColor: "var(--danger)" }} />

            {/* Header */}
            <div className="flex items-start justify-between gap-3 p-5 shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full animate-ping"
                    style={{ backgroundColor: "var(--danger)", animationDuration: "0.7s", boxShadow: "0 0 6px #ef4444" }} />
                  <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--danger)" }}>
                    INTERRUPT — DECISION REQUIRED
                  </span>
                </div>
                <h2 className="font-mono text-lg font-bold tracking-wide" style={{ color: "var(--text-amber)" }}>
                  {incident?.title.toUpperCase() ?? "MISSION CRITICAL"}
                </h2>
              </div>
              {(isResolved || !submitting) && (
                <button onClick={handleClose} className="font-mono text-xs mt-1 shrink-0 hover:opacity-100 transition-opacity"
                  style={{ color: "var(--text-muted)" }}>✕</button>
              )}
            </div>

            <div className="px-5 pb-3 shrink-0">
              <p className="font-mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-secondary)" }}>
                {isResolved ? "Decision recorded — stat data revealed"
                  : submitting ? "Transmitting decision..."
                  : pendingChoiceId ? "Confirm your selection below"
                  : "Select an approach"}
              </p>
            </div>

            {/* Options */}
            <div className="flex-1 px-5 flex flex-col gap-2 overflow-y-auto pb-2">
              {displayOptions.map((option) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  isSelected={pendingChoiceId === option.id && !isResolved}
                  isConfirmed={submitting || isResolved}
                  isResolved={isResolved}
                  isChosen={confirmedChoiceId === option.id}
                  topHeroId={interruptState.topHeroId}
                  heroIds={interruptState.heroIds}
                  onSelect={() => handleSelect(option.id)}
                />
              ))}
              {error && <div className="font-mono text-[10px] mt-1" style={{ color: "var(--danger)" }}>{error}</div>}
            </div>

            {/* Footer */}
            <div className="p-5 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              {isResolved ? (
                <motion.button onClick={handleClose}
                  className="w-full py-3 font-mono text-xs tracking-widest uppercase"
                  style={{ backgroundColor: "var(--border)", color: "var(--text-primary)" }}
                  whileHover={{ backgroundColor: "#252535" }} whileTap={{ scale: 0.98 }}>
                  Acknowledged
                </motion.button>
              ) : (
                <motion.button onClick={handleConfirm}
                  disabled={!pendingChoiceId || submitting}
                  className="w-full py-3 font-mono text-xs tracking-widest uppercase"
                  style={{
                    backgroundColor: pendingChoiceId && !submitting ? "var(--danger)" : "var(--border)",
                    color: pendingChoiceId && !submitting ? "#000" : "var(--text-muted)",
                    cursor: pendingChoiceId && !submitting ? "pointer" : "not-allowed",
                  }}
                  whileTap={pendingChoiceId && !submitting ? { scale: 0.98 } : {}}>
                  {submitting ? "Transmitting..." : "Confirm Decision"}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
