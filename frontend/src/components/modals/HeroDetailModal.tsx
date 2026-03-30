"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useGameStore } from "@/stores/gameStore";
import type { Hero } from "@/types/api";

interface Props {
  hero: Hero | null;
  onClose: () => void;
}

const STATS = [
  { key: "threat", label: "Threat", color: "#ef4444" },
  { key: "grit", label: "Grit", color: "#f97316" },
  { key: "presence", label: "Presence", color: "#a78bfa" },
  { key: "edge", label: "Edge", color: "#60a5fa" },
  { key: "tempo", label: "Tempo", color: "#34d399" },
] as const;

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] tracking-widest uppercase w-16 shrink-0" style={{ color: "#ffffff50" }}>
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "#1e1e2e" }}>
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value * 10}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        />
      </div>
      <span className="font-mono text-xs w-4 text-right" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

const availabilityLabel: Record<string, { text: string; color: string }> = {
  on_mission: { text: "DEPLOYED", color: "#3b82f6" },
  resting: { text: "RESTING", color: "#eab308" },
};

export function HeroDetailModal({ hero, onClose }: Props) {
  const heroState = hero ? useGameStore.getState().heroStates[hero.id] : null;
  const availability = heroState?.availability ?? hero?.availability;
  const health = heroState?.health ?? hero?.health;
  const portraitSrc =
    health === "injured" && hero?.injuredPortraitUrl
      ? hero.injuredPortraitUrl
      : hero?.portraitUrl;

  const status = availability ? availabilityLabel[availability] : null;

  return (
    <AnimatePresence>
      {hero && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed z-50 top-1/2 left-1/2 w-full max-w-md"
            style={{ x: "-50%", y: "-50%" }}
            initial={{ opacity: 0, scale: 0.92, y: "-46%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.92, y: "-46%" }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div
              className="relative overflow-hidden rounded-sm"
              style={{ backgroundColor: "#0a0a12", border: "1px solid #1e1e2e" }}
            >
              {/* Top accent line */}
              <div className="h-px w-full" style={{ background: "linear-gradient(to right, transparent, #fbbf2440, transparent)" }} />

              <div className="flex gap-5 p-5">
                {/* Portrait */}
                <div className="shrink-0">
                  <div
                    className="relative w-32 h-40 rounded-sm overflow-hidden"
                    style={{ border: "1px solid #1e1e2e" }}
                  >
                    {portraitSrc ? (
                      <Image src={portraitSrc} alt={hero.alias} fill sizes="128px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#0d0d1a" }}>
                        <span className="font-mono text-2xl" style={{ color: "#fbbf2440" }}>{hero.alias[0]}</span>
                      </div>
                    )}
                    {/* Health badge */}
                    {health === "injured" && (
                      <div className="absolute bottom-0 left-0 right-0 py-0.5 text-center font-mono text-[9px] tracking-widest" style={{ backgroundColor: "#7c2d12cc", color: "#fb923c" }}>
                        INJURED
                      </div>
                    )}
                    {health === "down" && (
                      <div className="absolute bottom-0 left-0 right-0 py-0.5 text-center font-mono text-[9px] tracking-widest" style={{ backgroundColor: "#450a0acc", color: "#ef4444" }}>
                        OFFLINE
                      </div>
                    )}
                  </div>

                  {/* Mission record */}
                  <div className="mt-2 flex gap-3 justify-center">
                    <div className="text-center">
                      <div className="font-mono text-sm" style={{ color: "#22c55e" }}>{hero.missionsCompleted}</div>
                      <div className="font-mono text-[9px] tracking-widest" style={{ color: "#ffffff30" }}>COMP</div>
                    </div>
                    <div className="w-px" style={{ backgroundColor: "#1e1e2e" }} />
                    <div className="text-center">
                      <div className="font-mono text-sm" style={{ color: "#ef4444" }}>{hero.missionsFailed}</div>
                      <div className="font-mono text-[9px] tracking-widest" style={{ color: "#ffffff30" }}>FAIL</div>
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-4">
                  {/* Header */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-mono text-base tracking-wide" style={{ color: "#fbbf24" }}>
                        {hero.alias.toUpperCase()}
                      </h2>
                      {status && (
                        <span className="font-mono text-[9px] tracking-widest px-1.5 py-0.5 rounded-sm" style={{ color: status.color, border: `1px solid ${status.color}40`, backgroundColor: `${status.color}10` }}>
                          {status.text}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs mt-0.5" style={{ color: "#ffffff40" }}>
                      {hero.name}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-col gap-2.5">
                    {STATS.map((s) => (
                      <StatBar key={s.key} label={s.label} value={hero[s.key]} color={s.color} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="px-5 pb-5">
                <div className="h-px mb-3" style={{ backgroundColor: "#1e1e2e" }} />
                <p className="font-mono text-[11px] leading-relaxed" style={{ color: "#ffffff60" }}>
                  {hero.bio}
                </p>
              </div>

              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 font-mono text-xs hover:opacity-100 transition-opacity"
                style={{ color: "#ffffff30" }}
              >
                ✕
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
