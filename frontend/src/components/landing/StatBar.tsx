interface Props {
  label: string;
  value: number;
  color: string;
  max?: number;
}

export function StatBar({ label, value, color, max = 10 }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="grid items-center gap-2.5 grid-cols-[78px_1fr_28px]">
      <span className="uppercase text-[9px] font-bold tracking-[0.16em] text-muted-text">
        {label}
      </span>
      <div className="relative overflow-hidden h-1.5 border border-border bg-[rgba(0,0,0,0.5)]">
        <div
          className="absolute top-0 left-0 h-full transition-[width] duration-350"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-right tabular-nums text-[10px] font-bold text-amber">
        {value}
      </span>
    </div>
  );
}
