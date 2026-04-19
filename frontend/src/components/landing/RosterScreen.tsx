"use client";

import { useState } from "react";
import type { Hero } from "@/types/api";
import { SHIFT_CAP } from "@/config/shift";
import { useGameStore } from "@/stores/gameStore";
import { useUser } from "@/lib/auth";
import { RosterSidebar } from "./RosterSidebar";
import { HeroPortrait } from "./HeroPortrait";
import { HeroInfo } from "./HeroInfo";

interface Props {
  heroes: Hero[];
}

export function RosterScreen({ heroes }: Props) {
  const { isSignedIn } = useUser();
  const shiftHeroIds = useGameStore((s) => s.shiftHeroIds);
  const setShiftHeroIds = useGameStore((s) => s.setShiftHeroIds);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const selected =
    heroes.find((h) => h.id === selectedId) ?? heroes[0] ?? null;
  const shiftFull = shiftHeroIds.length >= SHIFT_CAP;

  function toggleShift(id: string) {
    if (shiftHeroIds.includes(id)) {
      setShiftHeroIds(shiftHeroIds.filter((x) => x !== id));
    } else if (!shiftFull) {
      setShiftHeroIds([...shiftHeroIds, id]);
    }
  }

  return (
    <div className="flex flex-row h-full">
      <RosterSidebar
        heroes={heroes}
        search={search}
        onSearchChange={setSearch}
        selectedId={selectedId}
        onSelect={setSelectedId}
        isSignedIn={isSignedIn ?? false}
        shiftHeroIds={shiftHeroIds}
        onToggleShift={toggleShift}
      />

      <div className="flex-1 flex overflow-hidden">
        {selected ? (
          <>
            <HeroPortrait hero={selected} />
            <HeroInfo
              hero={selected}
              isSignedIn={isSignedIn ?? false}
              inShift={shiftHeroIds.includes(selected.id)}
              shiftFull={shiftFull}
              onToggle={() => toggleShift(selected.id)}
            />
          </>
        ) : (
          <div className="flex-1 grid place-items-center font-mono text-[11px] text-[var(--text-muted)]">
            No hero selected
          </div>
        )}
      </div>
    </div>
  );
}
