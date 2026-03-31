"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useGameStore } from "@/stores/gameStore";
import { useHeroes } from "@/hooks/useHeroes";
import { STAT_META_BY_KEY } from "@/lib/statMeta";
import type { InterruptOption } from "@/types/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Auto-close delay after resolution animation plays
const RESOLVE_AUTOCLOSE_MS = 7000;

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

// Count-up animation — number climbs then color shifts to outcome color
function StatRoll({
  requiredStat, combinedValue, requiredValue, outcome,
}: {
  requiredStat: string;
  combinedValue: number;
  requiredValue: number;
  outcome: "success" | "failure";
}) {
  const meta = STAT_META_BY_KEY[requiredStat as keyof typeof STAT_META_BY_KEY];
  const [displayed, setDisplayed] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const start = setTimeout(() => {
      let frame = 0;
      const totalFrames = 24;
      const iv = setInterval(() => {
        frame++;
        const t = frame / totalFrames;
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayed(Math.round(eased * combinedValue));
        if (frame >= totalFrames) {
          clearInterval(iv);
          setDisplayed(combinedValue);
          setTimeout(() => setSettled(true), 180);
        }
      }, 45);
      return () => clearInterval(iv);
    }, 250);
    return () => clearTimeout(start);
  }, [combinedValue]);

  const outcomeColor = outcome === "success" ? "#22c55e" : "#ef4444";

  return (
    <motion.div
      className="flex items-center gap-3 mt-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {meta && (
        <motion.div
          animate={settled ? { filter: `drop-shadow(0 0 5px ${outcomeColor}90)` } : { filter: "none" }}
          transition={{ duration: 0.5 }}
        >
          <meta.Icon size={20} style={{ color: settled ? outcomeColor : meta.color, transition: "color 0.4s ease" }} />
        </motion.div>
      )}
      {meta && (
        <span className="font-mono text-[10px] tracking-widest w-16 shrink-0" style={{ color: meta.color, opacity: 0.8 }}>
          {meta.label.toUpperCase()}
        </span>
      )}
      <div className="flex items-baseline gap-2 font-mono">
        <motion.span
          className="text-2xl font-bold tabular-nums"
          animate={{ color: settled ? outcomeColor : "#fbbf24" }}
          transition={{ duration: 0.45 }}
        >
          {displayed}
        </motion.span>
        <span className="text-xs" style={{ color: "#ffffff25" }}>vs</span>
        <motion.span
          className="text-base"
          animate={{ color: settled ? `${outcomeColor}70` : "#ffffff35" }}
          transition={{ duration: 0.45 }}
        >
          {requiredValue}
        </motion.span>
      </div>
    </motion.div>
  );
}

// Stat badge for non-chosen resolved options — slides in with stagger
function StatBadge({ requiredStat, requiredValue, delay }: { requiredStat: string; requiredValue: number; delay: number }) {
  const meta = STAT_META_BY_KEY[requiredStat as keyof typeof STAT_META_BY_KEY];
  return (
    <motion.div
      className="flex items-center gap-2 mt-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
    >
      {meta && <meta.Icon size={14} style={{ color: meta.color, opacity: 0.55 }} />}
      <span className="font-mono text-[9px] tracking-widest" style={{ color: "#ffffff30" }}>
        {meta?.label.toUpperCase() ?? requiredStat.toUpperCase()} ≥ {requiredValue}
      </span>
    </motion.div>
  );
}

function OptionRow({
  option, index, isSubmitting, isResolved, isChosen, topHeroId, heroIds,
  resolvedOutcome, resolvedCombinedValue, onSelect,
}: {
  option: InterruptOption;
  index: number;
  isSubmitting: boolean;
  isResolved: boolean;
  isChosen: boolean;
  topHeroId: string | null;
  heroIds: string[];
  resolvedOutcome: "success" | "failure" | null;
  resolvedCombinedValue: number | null;
  onSelect: () => void;
}) {
  const { data: heroes = [] } = useHeroes();
  const topHero = heroes.find((h) => h.id === topHeroId) ?? null;
  const topHeroDispatched = topHeroId != null && heroIds.includes(topHeroId);
  const isLocked = option.isHeroSpecific && !topHeroDispatched;

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

  const isDisabled = isSubmitting || isResolved || isLocked;
  const borderColor = isChosen ? "#fbbf24" : "var(--border)";
  const bgColor = isChosen ? "#fbbf2412" : "var(--panel-raised)";

  const showRoll =
    isChosen && isResolved && !option.isHeroSpecific &&
    option.requiredStat && option.requiredValue != null &&
    resolvedOutcome != null && resolvedCombinedValue != null;

  const showStatBadge =
    isResolved && !isChosen && !option.isHeroSpecific &&
    option.requiredStat && option.requiredValue != null;

  return (
    <motion.button
      onClick={!isDisabled ? onSelect : undefined}
      disabled={isDisabled}
      className="w-full text-left flex items-center gap-3 p-4 relative"
      style={{ border: `1px solid ${borderColor}`, backgroundColor: bgColor, cursor: isDisabled ? "default" : "pointer" }}
      whileHover={!isDisabled ? { borderColor: "#fbbf2450", backgroundColor: "#fbbf2408" } : {}}
      whileTap={!isDisabled ? { scale: 0.99 } : {}}
    >
      <AnimatePresence>
        {isChosen && (
          <motion.div className="absolute left-0 top-0 bottom-0 w-0.5"
            style={{ backgroundColor: "#fbbf24" }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ duration: 0.12 }} />
        )}
      </AnimatePresence>

      <div className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center"
        style={{ borderColor: isChosen ? "#fbbf24" : "#404060" }}>
        {isChosen && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#fbbf24" }} />}
      </div>

      {option.isHeroSpecific && topHero?.portraitUrl && (
        <div className="relative w-9 h-9 shrink-0 rounded overflow-hidden">
          <Image src={topHero.portraitUrl} alt={topHero.alias} fill sizes="36px" className="object-cover" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {option.text}
        </p>

        {showRoll && (
          <StatRoll
            requiredStat={option.requiredStat!}
            combinedValue={resolvedCombinedValue!}
            requiredValue={option.requiredValue!}
            outcome={resolvedOutcome!}
          />
        )}

        {showStatBadge && (
          <StatBadge
            requiredStat={option.requiredStat!}
            requiredValue={option.requiredValue!}
            delay={0.1 + index * 0.08}
          />
        )}
      </div>

      {isChosen && !isResolved && (
        <span className="font-mono text-[9px] tracking-widest shrink-0" style={{ color: "#ffffff40" }}>
          SENT
        </span>
      )}
    </motion.button>
  );
}

export function InterruptModal({ onClose }: Props) {
  const interruptState = useGameStore((s) => s.interruptState);
  const clearInterrupt = useGameStore((s) => s.clearInterrupt);
  const incidents = useGameStore((s) => s.incidents);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const incident = incidents.find((i) => i.id === interruptState?.incidentId) ?? null;
  const isResolved = !!interruptState?.resolved;
  const confirmedChoiceId = interruptState?.resolved?.chosenOptionId ?? submittedId;
  const resolvedOutcome = interruptState?.resolved?.outcome ?? null;
  const resolvedCombinedValue = interruptState?.resolved?.combinedValue ?? null;
  const displayOptions: InterruptOption[] = isResolved
    ? (interruptState?.resolved?.options ?? [])
    : (interruptState?.options ?? []);

  // Auto-close after resolution animation plays out
  useEffect(() => {
    if (!isResolved) return;
    const timer = setTimeout(() => {
      handleClose();
    }, RESOLVE_AUTOCLOSE_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResolved]);

  async function handleSelect(optionId: string) {
    if (submittedId || isResolved || !interruptState) return;
    setSubmittedId(optionId);
    setError(null);
    try {
      await submitChoice(interruptState.incidentId, optionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSubmittedId(null);
    }
  }

  function handleClose() {
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
                  {!isResolved && (
                    <div className="w-2 h-2 rounded-full animate-ping"
                      style={{ backgroundColor: "var(--danger)", animationDuration: "0.7s", boxShadow: "0 0 6px #ef4444" }} />
                  )}
                  <span className="font-mono text-[9px] tracking-widest" style={{ color: isResolved ? "#ffffff40" : "var(--danger)" }}>
                    {isResolved ? "DECISION RECORDED" : "INTERRUPT — DECISION REQUIRED"}
                  </span>
                </div>
                <h2 className="font-mono text-lg font-bold tracking-wide" style={{ color: "var(--text-amber)" }}>
                  {incident?.title.toUpperCase() ?? "MISSION CRITICAL"}
                </h2>
              </div>
              <button onClick={handleClose} className="font-mono text-xs mt-1 shrink-0 hover:opacity-100 transition-opacity"
                style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            <div className="px-5 pb-3 shrink-0">
              <p className="font-mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-secondary)" }}>
                {isResolved ? "Stat data revealed — closing shortly"
                  : submittedId ? "Awaiting response..."
                  : "Select an approach"}
              </p>
            </div>

            {/* Options */}
            <div className="flex-1 px-5 flex flex-col gap-2 overflow-y-auto pb-4">
              {displayOptions.map((option, i) => (
                <OptionRow
                  key={option.id}
                  option={option}
                  index={i}
                  isSubmitting={!!submittedId && !isResolved}
                  isResolved={isResolved}
                  isChosen={confirmedChoiceId === option.id}
                  topHeroId={interruptState.topHeroId}
                  heroIds={interruptState.heroIds}
                  resolvedOutcome={confirmedChoiceId === option.id ? resolvedOutcome : null}
                  resolvedCombinedValue={confirmedChoiceId === option.id ? resolvedCombinedValue : null}
                  onSelect={() => handleSelect(option.id)}
                />
              ))}
              {error && <div className="font-mono text-[10px] mt-1" style={{ color: "var(--danger)" }}>{error}</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
