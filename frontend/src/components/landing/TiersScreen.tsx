"use client";

import { TIERS } from "@/config/landingContent";
import { TierCard } from "./TierCard";

export function TiersScreen() {
  return (
    <div className="flex flex-col items-center justify-center gap-[36px] p-[40px] h-full">
      <div>
        <h2 className="text-center uppercase font-[var(--font-display)] font-bold text-[36px] tracking-[0.02em] text-[var(--text-hi)]">
          Access Tiers
        </h2>
        <p className="text-center italic font-[var(--font-serif)] text-sm text-[var(--text-secondary)] mt-2">
          Choose your clearance level.
        </p>
      </div>

      <div className="grid gap-[10px] grid-cols-[repeat(3,240px)]">
        {TIERS.map((t) => (
          <TierCard key={t.name} tier={t} />
        ))}
      </div>
    </div>
  );
}
