"use client";

import { useMemo } from "react";
import type { Hero } from "@/types/api";
import { SHIFT_CAP } from "@/config/shift";
import { HeroListItem } from "./HeroListItem";

interface Props {
  heroes: Hero[];
  search: string;
  onSearchChange: (v: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isSignedIn: boolean;
  shiftHeroIds: string[];
  onToggleShift: (id: string) => void;
}

export function RosterSidebar({
  heroes,
  search,
  onSearchChange,
  selectedId,
  onSelect,
  isSignedIn,
  shiftHeroIds,
  onToggleShift,
}: Props) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return heroes;
    return heroes.filter(
      (h) =>
        h.alias.toLowerCase().includes(q) || h.name.toLowerCase().includes(q),
    );
  }, [heroes, search]);

  const shiftCount = shiftHeroIds.length;
  const shiftFull = shiftCount >= SHIFT_CAP;

  return (
    <div className="shrink-0 flex flex-col w-70 border-r border-border bg-[rgba(10,9,8,0.45)]">
      <div className="px-3.5 py-3 border-b border-border">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search heroes"
          className="w-full font-mono outline-none text-[11px] tracking-[0.06em] text-primary-text border border-border px-2.5 py-2 transition-colors bg-[rgba(0,0,0,0.45)]"
        />
      </div>

      {isSignedIn && (
        <div className="flex items-center justify-between px-3.5 py-2.25 border-b border-border">
          <span className="uppercase text-[9px] font-bold tracking-[0.22em] text-muted-text">
            Shift roster
          </span>
          <span
            className="text-[10px] font-bold tracking-[0.14em]"
            style={{ color: shiftFull ? "var(--danger)" : "var(--text-amber)" }}
          >
            {shiftCount} / {SHIFT_CAP}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filtered.map((h) => (
          <HeroListItem
            key={h.id}
            hero={h}
            isActive={h.id === selectedId}
            inShift={shiftHeroIds.includes(h.id)}
            shiftFull={shiftFull}
            showShiftToggle={isSignedIn}
            onSelect={() => onSelect(h.id)}
            onToggleShift={() => onToggleShift(h.id)}
          />
        ))}
      </div>
    </div>
  );
}
