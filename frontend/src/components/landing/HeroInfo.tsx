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

export function HeroInfo({ hero, isSignedIn, inShift, shiftFull, onToggle }: Props) {
  return (
    <div className="flex-1 overflow-y-auto flex flex-col gap-[22px] px-[26px] py-[28px]">
      <div className="flex gap-[14px] flex-wrap items-center">
        {hero.age != null && (
          <span className="uppercase text-[10px] tracking-[0.16em] text-[var(--text-muted)]">
            Age <span className="text-[var(--text-primary)]">{hero.age}</span>
          </span>
        )}
        {hero.height && (
          <span className="uppercase text-[10px] tracking-[0.16em] text-[var(--text-muted)]">
            Height <span className="text-[var(--text-primary)]">{hero.height}</span>
          </span>
        )}
      </div>

      <Section title="Background">
        <p className="font-[var(--font-serif)] text-sm leading-[1.65] text-[var(--text-primary)]">
          {hero.bio}
        </p>
      </Section>

      <Section title="Stats">
        <div className="flex flex-col gap-[9px]">
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
        <div className="mt-auto pt-[8px]">
          <button
            onClick={onToggle}
            disabled={!inShift && shiftFull}
            className="w-full uppercase py-[13px] font-mono text-[10px] font-bold tracking-[0.24em] bg-transparent transition-colors"
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="uppercase text-[9px] font-bold tracking-[0.24em] text-[var(--text-muted)] border-b border-[var(--border)] pb-2 mb-[10px]">
        {title}
      </div>
      {children}
    </div>
  );
}
