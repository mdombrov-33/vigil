"use client";

import type { Hero } from "@/types/api";
import { HeroPortraitArt } from "./HeroPortraitArt";

interface Props {
  hero: Hero;
  isActive: boolean;
  inShift: boolean;
  shiftFull: boolean;
  showShiftToggle: boolean;
  onSelect: () => void;
  onToggleShift: () => void;
}

export function HeroListItem({
  hero,
  isActive,
  inShift,
  shiftFull,
  showShiftToggle,
  onSelect,
  onToggleShift,
}: Props) {
  return (
    <div
      onClick={onSelect}
      className="flex items-center gap-[10px] cursor-pointer relative py-[10px] pr-[14px] border-b border-[var(--border-subtle)] transition-colors"
      style={{
        paddingLeft: isActive ? 12 : 14,
        borderLeft: isActive
          ? "2px solid var(--text-amber)"
          : "2px solid transparent",
        background: isActive ? "rgba(240,168,0,0.06)" : "transparent",
      }}
    >
      <div className="flex-shrink-0 relative overflow-hidden w-8 h-8">
        <HeroPortraitArt hero={hero} variant="thumb" sizes="32px" />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="uppercase font-[var(--font-display)] font-bold text-[15px] leading-none tracking-[0.02em]"
          style={{ color: isActive ? "var(--text-amber)" : "var(--text-hi)" }}
        >
          {hero.alias}
        </div>
        <div className="uppercase whitespace-nowrap overflow-hidden text-ellipsis text-[8px] tracking-[0.14em] text-[var(--text-muted)] mt-[3px]">
          {(hero.labels ?? []).join("  ")}
        </div>
      </div>
      {showShiftToggle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleShift();
          }}
          disabled={!inShift && shiftFull}
          className="flex-shrink-0 grid place-items-center w-[22px] h-[22px] text-[11px] font-bold transition-colors"
          style={{
            background: inShift ? "var(--text-amber)" : "transparent",
            border: `1px solid ${inShift ? "var(--text-amber)" : "var(--border)"}`,
            color: inShift ? "var(--background)" : "var(--text-muted)",
            cursor: !inShift && shiftFull ? "not-allowed" : "pointer",
          }}
          title={inShift ? "Remove from shift" : "Add to shift"}
        >
          {inShift ? "✓" : "+"}
        </button>
      )}
    </div>
  );
}
