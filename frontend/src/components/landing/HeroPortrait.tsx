import type { Hero } from "@/types/api";
import { HeroPortraitArt } from "./HeroPortraitArt";

interface Props {
  hero: Hero;
}

export function HeroPortrait({ hero }: Props) {
  return (
    <div className="shrink-0 relative overflow-hidden w-90">
      <HeroPortraitArt hero={hero} variant="pane" sizes="360px" />
      <div className="absolute z-2 bottom-6 left-6 right-6">
        <div className="uppercase font-(--font-display) text-[48px] leading-[0.95] tracking-[0.01em] text-(--text-hi)">
          {hero.alias}
        </div>
        <div className="uppercase text-[10px] tracking-[0.22em] text-secondary-text mt-1.75">
          {hero.name}
        </div>
        {hero.labels && hero.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.25 mt-2.5">
            {hero.labels.map((l) => (
              <span
                key={l}
                className="uppercase text-[8px] font-bold tracking-[0.2em] text-secondary-text px-1.75 py-0.75 border border-border-bright bg-[rgba(0,0,0,0.5)]"
              >
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
