"use client";

import { useHeroes } from "@/hooks/useHeroes";
import { HeroPortrait } from "./HeroPortrait";
import type { Hero } from "@/types/api";

interface Props {
  onHeroClick: (hero: Hero) => void;
  selectedHeroIds?: string[];
  selectionMode?: boolean;
  maxSelections?: number;
  onHeroSelect?: (heroId: string) => void;
  dragEnabled?: boolean;
}

export function RosterBar({
  onHeroClick,
  selectedHeroIds = [],
  selectionMode = false,
  maxSelections,
  onHeroSelect,
  dragEnabled = false,
}: Props) {
  const { data: heroes = [] } = useHeroes();

  const handleClick = (hero: Hero) => {
    if (selectionMode && onHeroSelect) {
      onHeroSelect(hero.id);
    } else {
      onHeroClick(hero);
    }
  };

  return (
    <div
      className="relative h-full"
      style={{ borderTop: "1px solid #1e1e2e", background: "linear-gradient(to top, #05050a, #08080f)" }}
    >
      <div className="absolute top-0 left-0 right-0 h-px z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, transparent, #fbbf2420, transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none z-10"
        style={{ background: "linear-gradient(to right, transparent, #05050a)" }} />

      <div className="flex items-center h-full px-6 gap-6 overflow-x-auto roster-scroll">
        {heroes.map((hero) => (
          <HeroPortrait
            key={hero.id}
            hero={hero}
            onClick={() => handleClick(hero)}
            selected={selectedHeroIds.includes(hero.id)}
            draggable={dragEnabled}
            selectable={
              selectionMode
                ? selectedHeroIds.includes(hero.id) || maxSelections == null || selectedHeroIds.length < maxSelections
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
