"use client";

import { TIERS } from "@/config/landingContent";
import { TierCard } from "./TierCard";

export function TiersScreen() {
  return (
    <div className="flex flex-col items-center justify-center gap-9 p-10 h-full">
      <div>
        <h2 className="text-center uppercase font-(--font-display) text-[36px] tracking-[0.02em] text-(--text-hi)">
          Access Tiers
        </h2>
        <p className="text-center italic font-(--font-serif) text-sm text-secondary-text mt-2">
          Choose your clearance level.
        </p>
      </div>

      <div className="grid gap-2.5 grid-cols-[repeat(3,240px)]">
        {TIERS.map((t) => (
          <TierCard key={t.name} tier={t} />
        ))}
      </div>
    </div>
  );
}
