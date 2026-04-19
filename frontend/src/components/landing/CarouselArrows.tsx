interface Props {
  onPrev: () => void;
  onNext: () => void;
}

export function CarouselArrows({ onPrev, onNext }: Props) {
  return (
    <div className="absolute z-[3] right-4 top-1/2 -translate-y-1/2 flex flex-col gap-[6px]">
      <button
        onClick={onPrev}
        className="grid place-items-center w-7 h-7 text-xs text-[var(--text-secondary)] border border-[var(--border)] transition-colors bg-[rgba(0,0,0,0.5)]"
        aria-label="Previous hero"
      >
        ↑
      </button>
      <button
        onClick={onNext}
        className="grid place-items-center w-7 h-7 text-xs text-[var(--text-secondary)] border border-[var(--border)] transition-colors bg-[rgba(0,0,0,0.5)]"
        aria-label="Next hero"
      >
        ↓
      </button>
    </div>
  );
}
