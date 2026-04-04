"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useGameStore } from "@/stores/gameStore";
import type { Hero } from "@/types/api";
import { STAT_META } from "@/lib/statMeta";

interface Props {
  hero: Hero | null;
  onClose: () => void;
}

function StatRow({ statKey, value }: { statKey: typeof STAT_META[number]["key"]; value: number }) {
  const meta = STAT_META.find((s) => s.key === statKey)!;
  return (
    <div className="flex items-center gap-2.5">
      <meta.Icon size={10} style={{ color: meta.color }} className="shrink-0" />
      <span className="font-mono text-[9px] tracking-widest w-14 shrink-0" style={{ color: meta.color }}>
        {meta.label.toUpperCase()}
      </span>
      <div className="flex-1 flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div
            key={i}
            className="flex-1 h-1.5"
            style={{ backgroundColor: i < value ? meta.color : "#1a1a28" }}
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.2, delay: 0.05 + i * 0.02, ease: "easeOut" }}
          />
        ))}
      </div>
      <span className="font-mono text-[10px] w-4 text-right shrink-0 tabular-nums" style={{ color: meta.color }}>
        {value}
      </span>
    </div>
  );
}

const healthBadge: Record<string, { label: string; color: string; bg: string }> = {
  injured: { label: "INJURED", color: "#fb923c", bg: "#7c2d12cc" },
  down:    { label: "OFFLINE", color: "#ef4444", bg: "#450a0acc" },
};

const availabilityBadge: Record<string, { label: string; color: string }> = {
  on_mission: { label: "DEPLOYED", color: "#3b82f6" },
  resting:    { label: "RESTING",  color: "#eab308" },
};

export function HeroDetailModal({ hero, onClose }: Props) {
  const heroState = hero ? useGameStore.getState().heroStates[hero.id] : null;
  const availability = heroState?.availability ?? hero?.availability;
  const health = heroState?.health ?? hero?.health;

  const portraitSrc =
    health === "injured" && hero?.injuredPortraitUrl
      ? hero.injuredPortraitUrl
      : hero?.portraitUrl;

  const hBadge = health && health !== "healthy" ? healthBadge[health] : null;
  const aBadge = availability ? availabilityBadge[availability] : null;
  const total = (hero?.missionsCompleted ?? 0) + (hero?.missionsFailed ?? 0);

  return (
    <AnimatePresence>
      {hero && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed z-50 top-1/2 left-1/2 w-full max-w-lg"
            style={{ x: "-50%", y: "-50%", backgroundColor: "#06060e", border: "1px solid #1e1e2e", maxHeight: "88vh" }}
            initial={{ opacity: 0, scale: 0.94, y: "-46%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.94, y: "-46%" }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div className="flex overflow-hidden" style={{ maxHeight: "88vh" }}>

              {/* LEFT — portrait + labels */}
              <div className="relative shrink-0 flex flex-col" style={{ width: 160 }}>
                {/* Portrait */}
                <div className="relative flex-1 overflow-hidden">
                  {portraitSrc ? (
                    <Image
                      src={portraitSrc}
                      alt={hero.alias}
                      fill
                      sizes="160px"
                      className="object-cover object-top"
                      style={{ filter: hBadge?.color === "#ef4444" ? "grayscale(0.3)" : "none" }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#0d0d1a" }}>
                      <span className="font-mono text-5xl" style={{ color: "#fbbf2420" }}>{hero.alias[0]}</span>
                    </div>
                  )}
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to right, transparent 70%, #06060e 100%)" }} />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #06060e 0%, transparent 40%)" }} />
                  {hBadge && (
                    <div className="absolute top-3 left-3 px-2 py-0.5 font-mono text-[8px] tracking-widest z-10"
                      style={{ backgroundColor: hBadge.bg, color: hBadge.color, border: `1px solid ${hBadge.color}50` }}>
                      {hBadge.label}
                    </div>
                  )}
                </div>

                {/* Labels */}
                {hero.labels && hero.labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-2 py-3" style={{ borderTop: "1px solid #1e1e2e" }}>
                    {hero.labels.map((label) => (
                      <span key={label} className="font-mono text-[9px] tracking-widest px-1.5 py-0.5"
                        style={{ color: "var(--text-secondary)", border: "1px solid #1e1e2e" }}>
                        {label.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT — all info */}
              <div className="flex-1 flex flex-col overflow-hidden" style={{ borderLeft: "1px solid #1e1e2e" }}>

                {/* Header */}
                <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid #1e1e2e" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-mono text-lg font-bold tracking-widest leading-none" style={{ color: "#fbbf24" }}>
                        {hero.alias.toUpperCase()}
                      </h2>
                      <span className="font-mono text-[9px] tracking-widest mt-1 block" style={{ color: "var(--text-secondary)" }}>
                        {hero.name.toUpperCase()}
                      </span>
                      {(hero.age || hero.height) && (
                        <div className="flex flex-col gap-0.5 mt-2">
                          {hero.age && (
                            <div className="flex gap-2">
                              <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>AGE:</span>
                              <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-secondary)" }}>{hero.age}</span>
                            </div>
                          )}
                          {hero.height && (
                            <div className="flex gap-2">
                              <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>HEIGHT:</span>
                              <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-secondary)" }}>{hero.height}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button onClick={onClose}
                        className="font-mono text-xs w-6 h-6 flex items-center justify-center hover:opacity-100 transition-opacity"
                        style={{ color: "var(--text-muted)", border: "1px solid #1e1e2e" }}>
                        ✕
                      </button>
                      {aBadge && (
                        <span className="font-mono text-[8px] tracking-widest px-2 py-0.5"
                          style={{ color: aBadge.color, border: `1px solid ${aBadge.color}50`, backgroundColor: `${aBadge.color}18` }}>
                          {aBadge.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scrollable */}
                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 py-3 flex flex-col gap-2.5" style={{ borderBottom: "1px solid #1e1e2e" }}>
                    {STAT_META.map((s) => (
                      <StatRow key={s.key} statKey={s.key} value={hero[s.key]} />
                    ))}
                  </div>
                  {(hero.bio || total > 0) && (
                    <div className="px-4 py-3 flex flex-col gap-2">
                      {hero.bio && (
                        <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                          {hero.bio}
                        </p>
                      )}
                      {total > 0 && (
                        <p className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                          <span style={{ color: "#22c55e" }}>{hero.missionsCompleted}</span> completed
                          {" · "}
                          <span style={{ color: "#ef4444" }}>{hero.missionsFailed}</span> failed
                        </p>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
