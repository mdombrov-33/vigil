import type { Hero } from "@/types/api";
import { HeroPortraitArt } from "./HeroPortraitArt";

interface Props {
  hero: Hero;
}

export function HeroPortrait({ hero }: Props) {
  return (
    <div className="flex-shrink-0 relative overflow-hidden w-[360px]">
      <HeroPortraitArt hero={hero} variant="pane" sizes="360px" />
      <div className="absolute z-[2] bottom-6 left-6 right-6">
        <div className="uppercase font-[var(--font-display)] font-bold text-[48px] leading-[0.95] tracking-[0.01em] text-[var(--text-hi)]">
          {hero.alias}
        </div>
        <div className="uppercase text-[10px] tracking-[0.22em] text-[var(--text-secondary)] mt-[7px]">
          {hero.name}
        </div>
        {hero.labels && hero.labels.length > 0 && (
          <div className="flex flex-wrap gap-[5px] mt-[10px]">
            {hero.labels.map((l) => (
              <span
                key={l}
                className="uppercase text-[8px] font-bold tracking-[0.2em] text-[var(--text-secondary)] px-[7px] py-[3px] border border-[var(--border-bright)] bg-[rgba(0,0,0,0.5)]"
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
