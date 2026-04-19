import type { Tier } from "@/config/landingContent";

interface Props {
  tier: Tier;
}

export function TierCard({ tier }: Props) {
  const featured = tier.featured ?? false;
  return (
    <div
      className="relative flex flex-col gap-[14px] px-[22px] py-[26px] transition-colors"
      style={{
        background: featured ? "rgba(240,168,0,0.03)" : "var(--panel)",
        border: `1px solid ${featured ? "rgba(240,168,0,0.45)" : "var(--border)"}`,
      }}
    >
      {featured && (
        <span className="absolute -top-px left-1/2 -translate-x-1/2 uppercase text-[8px] font-bold tracking-[0.24em] px-[10px] py-[3px] bg-[var(--text-amber)] text-[var(--background)]">
          RECOMMENDED
        </span>
      )}
      <div className="uppercase font-[var(--font-display)] font-bold text-xl text-[var(--text-hi)]">
        {tier.name}
      </div>
      <div className="flex items-baseline gap-[4px]">
        <span className="font-[var(--font-display)] font-bold text-[38px] leading-none text-[var(--text-amber)]">
          {tier.price}
        </span>
        {tier.per && (
          <span className="text-[10px] tracking-[0.14em] text-[var(--text-muted)]">
            {tier.per}
          </span>
        )}
      </div>
      <div className="h-px bg-[var(--border)]" />
      <div className="flex flex-col gap-[7px]">
        {tier.features.map((f, i) => (
          <div
            key={i}
            className="flex gap-[8px] items-start text-[11px] leading-[1.4] text-[var(--text-secondary)]"
          >
            <span
              className="flex-shrink-0 mt-px"
              style={{ color: f.on ? "var(--success)" : "var(--text-muted)" }}
            >
              ✓
            </span>
            <span style={{ opacity: f.on ? 1 : 0.4 }}>{f.text}</span>
          </div>
        ))}
      </div>
      <button
        className="uppercase mt-auto w-full py-[11px] font-mono text-[10px] font-bold tracking-[0.26em] transition-colors"
        style={{
          background: featured ? "var(--text-amber)" : "transparent",
          border: `1px solid ${featured ? "var(--text-amber)" : "rgba(240,168,0,0.4)"}`,
          color: featured ? "var(--background)" : "var(--text-amber)",
        }}
      >
        {tier.cta}
      </button>
    </div>
  );
}
