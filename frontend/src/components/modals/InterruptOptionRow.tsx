"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useHeroes } from "@/hooks/useHeroes";
import { STAT_META_BY_KEY } from "@/config/statMeta";
import type { InterruptOption } from "@/types/api";

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

  const outcomeColor = outcome === "success" ? "var(--success)" : "var(--danger)";

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
          animate={{ color: settled ? outcomeColor : "var(--text-amber)" }}
          transition={{ duration: 0.45 }}
        >
          {displayed}
        </motion.span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>vs</span>
        <motion.span
          className="text-base"
          animate={{ color: settled ? outcomeColor : "var(--text-muted)" }}
          transition={{ duration: 0.45 }}
        >
          {requiredValue}
        </motion.span>
      </div>
    </motion.div>
  );
}

// Stat badge for non-chosen resolved options
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
      <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>
        {meta?.label.toUpperCase() ?? requiredStat.toUpperCase()} ≥ {requiredValue}
      </span>
    </motion.div>
  );
}

interface Props {
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
}

export function InterruptOptionRow({
  option, index, isSubmitting, isResolved, isChosen, topHeroId, heroIds,
  resolvedOutcome, resolvedCombinedValue, onSelect,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const { data: heroes = [] } = useHeroes();
  const topHero = heroes.find((h) => h.id === topHeroId) ?? null;
  const topHeroDispatched = topHeroId != null && heroIds.includes(topHeroId);
  const isLocked = option.isHeroSpecific && !topHeroDispatched;

  if (isLocked && !isResolved) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ border: "1px solid var(--border)", backgroundColor: "var(--panel-inset)" }}
      >
        <div className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center"
          style={{ borderColor: "var(--border-bright)" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--border-bright)" }} />
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
  const borderColor = isChosen ? "var(--text-amber)" : "var(--border)";
  const bgColor = isChosen ? "var(--amber-subtle)" : "var(--panel-raised)";

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
      style={{
        border: `1px solid ${hovered && !isDisabled ? "var(--text-amber)" : borderColor}`,
        backgroundColor: hovered && !isDisabled ? "var(--amber-subtle)" : bgColor,
        cursor: isDisabled ? "default" : "pointer",
        transition: "border-color 0.18s ease, background-color 0.18s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={!isDisabled ? { scale: 0.99 } : {}}
    >
      <AnimatePresence>
        {isChosen && (
          <motion.div className="absolute left-0 top-0 bottom-0 w-0.5"
            style={{ backgroundColor: "var(--text-amber)" }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ duration: 0.12 }} />
        )}
      </AnimatePresence>

      <div className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center"
        style={{ borderColor: isChosen ? "var(--text-amber)" : "#404060" }}>
        {isChosen && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--text-amber)" }} />}
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
        <span className="font-mono text-[9px] tracking-widest shrink-0" style={{ color: "var(--text-muted)" }}>
          SENT
        </span>
      )}
    </motion.button>
  );
}
