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

      <aside className="shrink-0 flex flex-col overflow-y-auto border-l border-border px-12 py-11 gap-7.5 w-[45%] max-w-160 bg-[rgba(10,9,8,0.5)]">
        <div>
          <div className="uppercase text-[9px] font-bold tracking-[0.3em] text-muted-text">
            Superhero Dispatch Network
          </div>
          <div className="uppercase font-(--font-display) text-[30px] leading-[1.05] text-(--text-hi) mt-2">
            The city
            <br />
            doesn&apos;t wait.
          </div>
          <p className="italic font-(--font-serif) text-sm leading-[1.65] text-secondary-text mt-2.5">
            Incidents break across the map. You have heroes, a clock, and one
            shift to prove your read on both is right.
          </p>
        </div>

        <div className="h-px bg-border" />

        <div className="flex flex-col gap-3.5">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-3 items-start">
              <span className="font-(--font-display) text-[22px] leading-none shrink-0 w-6 text-border-bright">
                {s.n}
              </span>
              <div>
                <div className="uppercase text-[11px] font-bold tracking-[0.14em] text-primary-text mb-0.5">
                  {s.title}
                </div>
                <div className="text-[11px] leading-[1.55] text-secondary-text">
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-px bg-border" />

        <div className="mt-auto">
          <button
            onClick={() => isSignedIn && !starting && onStartShift()}
            disabled={!isSignedIn || starting}
            className="w-full uppercase py-3.25 font-mono text-[11px] font-bold tracking-[0.3em] bg-transparent transition-colors"
            style={{
              border: `1px solid ${isSignedIn ? "rgba(240,168,0,0.5)" : "var(--border)"}`,
              color: isSignedIn ? "var(--text-amber)" : "var(--text-muted)",
              cursor: !isSignedIn || starting ? "default" : "pointer",
              opacity: starting ? 0.7 : 1,
            }}
          >
            {starting ? "Initializing…" : "Start Shift"}
          </button>
          <div className="uppercase text-center text-[9px] tracking-[0.18em] text-muted-text mt-1.5">
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
