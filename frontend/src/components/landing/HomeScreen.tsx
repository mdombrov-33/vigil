"use client";

import type { Hero } from "@/types/api";
import { useUser } from "@/lib/auth";
import { STEPS } from "@/config/landingContent";
import { HeroCarousel } from "./HeroCarousel";

interface Props {
  heroes: Hero[];
  onStartShift: () => void;
  starting: boolean;
}

export function HomeScreen({ heroes, onStartShift, starting }: Props) {
  const { isSignedIn } = useUser();

  return (
    <div className="flex flex-row h-full">
      <HeroCarousel heroes={heroes} />

      <aside className="flex-shrink-0 flex flex-col overflow-y-auto border-l border-[var(--border)] px-12 py-11 gap-[30px] w-[45%] max-w-[640px] bg-[rgba(10,9,8,0.5)]">
        <div>
          <div className="uppercase text-[9px] font-bold tracking-[0.3em] text-[var(--text-muted)]">
            Superhero Dispatch Network
          </div>
          <div className="uppercase font-[var(--font-display)] font-bold text-[30px] leading-[1.05] text-[var(--text-hi)] mt-2">
            The city
            <br />
            doesn&apos;t wait.
          </div>
          <p className="italic font-[var(--font-serif)] text-sm leading-[1.65] text-[var(--text-secondary)] mt-[10px]">
            Incidents break across the map. You have heroes, a clock, and one
            shift to prove your read on both is right.
          </p>
        </div>

        <div className="h-px bg-[var(--border)]" />

        <div className="flex flex-col gap-[14px]">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-[12px] items-start">
              <span className="font-[var(--font-display)] font-bold text-[22px] leading-none flex-shrink-0 w-6 text-[var(--border-bright)]">
                {s.n}
              </span>
              <div>
                <div className="uppercase text-[11px] font-bold tracking-[0.14em] text-[var(--text-primary)] mb-[2px]">
                  {s.title}
                </div>
                <div className="text-[11px] leading-[1.55] text-[var(--text-secondary)]">
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-px bg-[var(--border)]" />

        <div className="mt-auto">
          <button
            onClick={() => isSignedIn && !starting && onStartShift()}
            disabled={!isSignedIn || starting}
            className="w-full uppercase py-[13px] font-mono text-[11px] font-bold tracking-[0.3em] bg-transparent transition-colors"
            style={{
              border: `1px solid ${isSignedIn ? "rgba(240,168,0,0.5)" : "var(--border)"}`,
              color: isSignedIn ? "var(--text-amber)" : "var(--text-muted)",
              cursor: !isSignedIn || starting ? "default" : "pointer",
              opacity: starting ? 0.7 : 1,
            }}
          >
            {starting ? "Initializing…" : "Start Shift"}
          </button>
          <div className="uppercase text-center text-[9px] tracking-[0.18em] text-[var(--text-muted)] mt-[6px]">
            {starting
              ? "Opening dispatch channel"
              : isSignedIn
                ? "Your roster is ready"
                : "Sign in to begin your shift"}
          </div>
        </div>
      </aside>
    </div>
  );
}
