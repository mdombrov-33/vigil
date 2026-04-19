"use client";

import type { Hero } from "@/types/api";
import { STAT_META } from "@/config/statMeta";
import { StatBar } from "./StatBar";

interface Props {
  hero: Hero;
  isSignedIn: boolean;
  inShift: boolean;
  shiftFull: boolean;
  onToggle: () => void;
}

export function HeroInfo({
  hero,
  isSignedIn,
  inShift,
  shiftFull,
  onToggle,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-5.5 px-6.5 py-7">
      <div className="flex gap-3.5 flex-wrap items-center">
        {hero.age != null && (
          <span className="uppercase text-[10px] tracking-[0.16em] text-muted-text">
            Age <span className="text-primary-text">{hero.age}</span>
          </span>
        )}
        {hero.height && (
          <span className="uppercase text-[10px] tracking-[0.16em] text-muted-text">
            Height <span className="text-primary-text">{hero.height}</span>
          </span>
        )}
      </div>

      <Section title="Background">
        <p className="font-(--font-serif) text-sm leading-[1.65] text-primary-text">
          {hero.bio}
        </p>
      </Section>

      <Section title="Stats">
        <div className="flex flex-col gap-2.25">
          {STAT_META.map((s) => (
            <StatBar
              key={s.key}
              label={s.label}
              value={hero[s.key] as number}
              color={s.color}
            />
          ))}
        </div>
      </Section>

      {isSignedIn && (
        <div className="mt-auto pt-2">
          <button
            onClick={onToggle}
            disabled={!inShift && shiftFull}
            className="w-full uppercase py-3.25 font-mono text-[10px] font-bold tracking-[0.24em] bg-transparent transition-colors"
            style={{
              border: `1px solid ${inShift ? "oklch(0.63 0.22 25 / 0.4)" : "rgba(240,168,0,0.45)"}`,
              color: inShift ? "var(--danger)" : "var(--text-amber)",
              cursor: !inShift && shiftFull ? "not-allowed" : "pointer",
              opacity: !inShift && shiftFull ? 0.5 : 1,
            }}
          >
            {inShift
              ? "Remove from Shift"
              : shiftFull
                ? "Shift Full"
                : "Add to Shift"}
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="uppercase text-[9px] font-bold tracking-[0.24em] text-muted-text border-b border-border pb-2 mb-2.5">
        {title}
      </div>
      {children}
    </div>
  );
}
