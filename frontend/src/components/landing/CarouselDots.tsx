import type { Hero } from "@/types/api";

interface Props {
  heroes: Hero[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function CarouselDots({ heroes, activeIndex, onSelect }: Props) {
  return (
    <div className="absolute z-3 left-9 bottom-4 flex gap-1.25">
      {heroes.map((h, i) => {
        const isActive = i === activeIndex;
        return (
          <button
            key={h.id}
            onClick={() => onSelect(i)}
            className="h-0.5 transition-all"
            style={{
              width: isActive ? 30 : 20,
              background: isActive
                ? "var(--text-amber)"
                : "var(--border-bright)",
            }}
            aria-label={`Go to ${h.alias}`}
          />
        );
      })}
    </div>
  );
}
