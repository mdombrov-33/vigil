"use client";

import { useGameStore } from "@/stores/gameStore";
import { NumberTicker } from "@/components/ui/number-ticker";

const SEGMENTS = 20;

interface Props {
  onEndShift?: () => void;
  shiftStarted?: boolean;
}

export function CityHealthBar({ onEndShift, shiftStarted }: Props) {
  const cityHealth = useGameStore((s) => s.cityHealth);
  const score = useGameStore((s) => s.score);
  const filledSegments = Math.round((cityHealth / 100) * SEGMENTS);
  const isCritical = cityHealth <= 30;

  return (
    <div className="flex items-center gap-4 h-full px-4">
      {/* Brand */}
      <span className="font-mono text-xs tracking-widest uppercase shrink-0" style={{ color: "#fbbf24" }}>
        VIGIL SDN
      </span>

      {shiftStarted && (
        <>
          {/* Health bar */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-white/40 mr-1 shrink-0">CITY</span>
            <div className="flex gap-0.5">
              {Array.from({ length: SEGMENTS }).map((_, i) => {
                const filled = i < filledSegments;
                const segColor = isCritical
                  ? filled ? "#ef4444" : "#1e1e2e"
                  : filled ? "#22c55e" : "#1e1e2e";
                return (
                  <div
                    key={i}
                    className={`w-2.5 h-3.5 rounded-sm transition-colors ${isCritical && filled ? "animate-pulse" : ""}`}
                    style={{ backgroundColor: segColor }}
                  />
                );
              })}
            </div>
            <NumberTicker
              value={cityHealth}
              className={`font-mono text-[10px] ml-1 shrink-0 tabular-nums ${isCritical ? "text-red-500" : "text-green-500"}`}
            />
          </div>

          {/* Score */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-white/40">SCORE</span>
            <NumberTicker value={score} className="font-mono text-sm tabular-nums text-amber-400" />
          </div>
        </>
      )}

      {/* End shift — right side */}
      {shiftStarted && onEndShift && (
        <button
          onClick={onEndShift}
          className="ml-auto font-mono text-[9px] tracking-widest uppercase px-2 py-1 hover:opacity-100 transition-opacity"
          style={{ color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
        >
          End Shift
        </button>
      )}
    </div>
  );
}
