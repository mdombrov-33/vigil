"use client";

import { motion } from "framer-motion";

interface Props {
  score: number;
  cityHealth: number;
  onEndShift: () => void;
}

function getGrade(score: number): { grade: string; label: string; color: string } {
  if (score >= 600) return { grade: "S", label: "EXEMPLARY", color: "#22c55e" };
  if (score >= 400) return { grade: "A", label: "OUTSTANDING", color: "#86efac" };
  if (score >= 250) return { grade: "B", label: "COMPETENT", color: "#fbbf24" };
  if (score >= 100) return { grade: "C", label: "ADEQUATE", color: "#f97316" };
  return { grade: "D", label: "NEEDS REVIEW", color: "#ef4444" };
}

export function ShiftEndScreen({ score, cityHealth, onEndShift }: Props) {
  const { grade, label, color } = getGrade(score);

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ backgroundColor: "rgba(8,8,15,0.92)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        className="flex flex-col items-center gap-6 text-center"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[10px] tracking-[0.3em]" style={{ color: "var(--text-muted)" }}>
            SDN — SHIFT COMPLETE
          </span>
          <div className="w-16 h-px mt-1" style={{ backgroundColor: "var(--border)" }} />
        </div>

        {/* Grade */}
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono font-bold" style={{ fontSize: 96, lineHeight: 1, color }}>
            {grade}
          </span>
          <span className="font-mono text-xs tracking-[0.2em]" style={{ color }}>
            {label}
          </span>
        </div>

        {/* Stats */}
        <div className="flex gap-8 font-mono">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold" style={{ color: "var(--text-amber)" }}>{score}</span>
            <span className="text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>SCORE</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold" style={{ color: cityHealth > 50 ? "#22c55e" : cityHealth > 25 ? "#f97316" : "#ef4444" }}>
              {cityHealth}
            </span>
            <span className="text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>CITY HP</span>
          </div>
        </div>

        {/* End shift button */}
        <motion.button
          onClick={onEndShift}
          className="font-mono text-xs tracking-widest uppercase px-8 py-3 mt-2"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
            backgroundColor: "transparent",
          }}
          whileHover={{ borderColor: "var(--text-amber)", color: "var(--text-amber)" }}
          whileTap={{ scale: 0.97 }}
        >
          End Shift
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
