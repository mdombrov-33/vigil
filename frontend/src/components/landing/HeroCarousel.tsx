"use client";

import { useEffect, useRef, useState } from "react";
import type { Hero } from "@/types/api";
import { HeroPortraitArt } from "./HeroPortraitArt";
import { CarouselArrows } from "./CarouselArrows";
import { CarouselDots } from "./CarouselDots";

const AUTO_MS = 4500;

interface Props {
  heroes: Hero[];
}

export function HeroCarousel({ heroes }: Props) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || heroes.length <= 1) return;
    timerRef.current = setInterval(
      () => setIdx((i) => (i + 1) % heroes.length),
      AUTO_MS,
    );
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, heroes.length]);

  const safeIdx = heroes.length > 0 ? idx % heroes.length : 0;

  function go(delta: number) {
    if (heroes.length === 0) return;
    setIdx((i) => (i + delta + heroes.length) % heroes.length);
  }

  return (
    <div
      className="flex-1 relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {heroes.map((h, i) => {
        const active = i === safeIdx;
        return (
          <div
            key={h.id}
            className="absolute inset-0 transition-opacity duration-[900ms] ease-out"
            style={{
              opacity: active ? 1 : 0,
              pointerEvents: active ? "auto" : "none",
            }}
          >
            <HeroPortraitArt
              hero={h}
              variant="stage"
              priority={active}
              sizes="(max-width: 1024px) 100vw, 70vw"
            />

            <div className="absolute z-[2] left-9 bottom-8 right-[120px]">
              <div className="uppercase text-[9px] tracking-[0.28em] text-[var(--text-muted)] mb-[10px]">
                SDN Active Roster
              </div>
              <div className="uppercase font-[var(--font-display)] font-bold text-[64px] leading-[0.93] tracking-[0.01em] text-[var(--text-hi)]">
                {h.alias}
              </div>
              <div className="uppercase text-[10px] tracking-[0.22em] text-[var(--text-secondary)] mt-2">
                {h.name}
              </div>
              {h.labels && h.labels.length > 0 && (
                <div className="flex flex-wrap gap-[5px] mt-[12px]">
                  {h.labels.map((l) => (
                    <span
                      key={l}
                      className="uppercase text-[8px] font-bold tracking-[0.2em] text-[var(--text-secondary)] px-2 py-1 border border-[var(--border-bright)] bg-[rgba(0,0,0,0.45)]"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {heroes.length > 1 && (
        <>
          <CarouselArrows onPrev={() => go(-1)} onNext={() => go(1)} />
          <CarouselDots
            heroes={heroes}
            activeIndex={safeIdx}
            onSelect={setIdx}
          />
        </>
      )}
    </div>
  );
}
