"use client";

import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useEffect } from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { useGameStore } from "@/stores/gameStore";
import type { Hero } from "@/types/api";
import { sounds } from "@/sounds";
import { STAT_META } from "@/config/statMeta";

interface Props {
  hero: Hero | null;
  onClose: () => void;
}

const healthBadge: Record<string, { label: string; color: string; bg: string; border: string }> = {
  injured: { label: "INJURED", color: "var(--warning)", bg: "var(--warning-subtle)", border: "var(--warning-border)" },
  down:    { label: "OFFLINE", color: "var(--danger)",  bg: "var(--danger-subtle)",  border: "var(--danger-border)"  },
};

const availabilityBadge: Record<string, { label: string; color: string; bg: string; border: string }> = {
  on_mission: { label: "DEPLOYED", color: "var(--info)",       bg: "var(--info-subtle)",    border: "var(--info-border)"    },
  resting:    { label: "RESTING",  color: "var(--text-amber)", bg: "var(--amber-subtle)",   border: "var(--amber-border)"   },
};

export function HeroDetailModal({ hero, onClose }: Props) {
  useEffect(() => { if (hero) sounds.modalOpen(); }, [hero?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  function handleClose() { sounds.modalClose(); onClose(); }

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

  const radarData = hero
    ? STAT_META.map((s) => ({ stat: s.abbr, value: hero[s.key as keyof Hero] as number }))
    : [];

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
            onClick={handleClose}
          />

          <motion.div
            className="fixed z-50 top-1/2 left-1/2 w-full"
            style={{
              x: "-50%",
              y: "-50%",
              maxWidth: 680,
              backgroundColor: "var(--panel)",
              border: "1px solid var(--border)",
              maxHeight: "88vh",
            }}
            initial={{ opacity: 0, scale: 0.94, y: "-46%" }}
            animate={{ opacity: 1, scale: 1, y: "-50%" }}
            exit={{ opacity: 0, scale: 0.94, y: "-46%" }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div className="flex overflow-hidden" style={{ maxHeight: "88vh" }}>

              {/* LEFT — large portrait */}
              <div className="relative shrink-0" style={{ width: 260 }}>
                {portraitSrc ? (
                  <Image
                    src={portraitSrc}
                    alt={hero.alias}
                    fill
                    sizes="260px"
                    className="object-cover object-top"
                    style={{ filter: health === "down" ? "grayscale(0.5)" : "none" }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "var(--panel-inset)" }}>
                    <span className="font-mono text-6xl" style={{ color: "var(--amber-subtle)" }}>{hero.alias[0]}</span>
                  </div>
                )}
                {/* Right fade into panel */}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to right, transparent 65%, var(--panel) 100%)" }} />
                {/* Bottom fade */}
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--panel) 0%, transparent 35%)" }} />

                {/* Health badge */}
                {hBadge && (
                  <div
                    className="absolute top-3 left-3 px-2 py-0.5 font-mono text-[8px] tracking-widest z-10"
                    style={{ backgroundColor: hBadge.bg, color: hBadge.color, border: `1px solid ${hBadge.border}` }}
                  >
                    {hBadge.label}
                  </div>
                )}

                {/* Name + alias pinned at bottom of portrait */}
                <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                  <div className="font-mono text-xl font-bold tracking-widest leading-none" style={{ color: "var(--text-amber)" }}>
                    {hero.alias.toUpperCase()}
                  </div>
                  <div className="font-mono text-[9px] tracking-widest mt-1" style={{ color: "var(--text-secondary)" }}>
                    {hero.name.toUpperCase()}
                  </div>
                  {hero.labels && hero.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {hero.labels.map((label) => (
                        <span
                          key={label}
                          className="font-mono text-[8px] tracking-widest px-1.5 py-0.5"
                          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)", backgroundColor: "var(--panel-inset)" }}
                        >
                          {label.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT — info + radar */}
              <div className="flex-1 flex flex-col overflow-hidden" style={{ borderLeft: "1px solid var(--border)" }}>

                {/* Header row */}
                <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex flex-col gap-1.5">
                    {(hero.age || hero.height) && (
                      <div className="flex gap-3">
                        {hero.age && (
                          <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                            AGE <span style={{ color: "var(--text-secondary)" }}>{hero.age}</span>
                          </span>
                        )}
                        {hero.height && (
                          <span className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                            HT <span style={{ color: "var(--text-secondary)" }}>{hero.height}</span>
                          </span>
                        )}
                      </div>
                    )}
                    {aBadge && (
                      <span
                        className="font-mono text-[8px] tracking-widest self-start px-2 py-0.5"
                        style={{ color: aBadge.color, border: `1px solid ${aBadge.border}`, backgroundColor: aBadge.bg }}
                      >
                        {aBadge.label}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleClose}
                    className="font-mono text-xs w-6 h-6 flex items-center justify-center hover:opacity-100 transition-opacity shrink-0"
                    style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    ✕
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto flex flex-col">

                  {/* Bio */}
                  {hero.bio && (
                    <div className="px-4 pt-3 pb-2 shrink-0">
                      <p className="font-mono text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {hero.bio}
                      </p>
                    </div>
                  )}

                  {/* Radar chart */}
                  <div className="px-2 shrink-0" style={{ height: 200, pointerEvents: "none" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="68%">
                        <PolarGrid stroke="#ffffff12" />
                        <PolarAngleAxis
                          dataKey="stat"
                          tick={{ fill: "#6a5e48", fontSize: 9, fontFamily: "monospace" }}
                        />
                        <Radar
                          name="Stats"
                          dataKey="value"
                          stroke="var(--text-amber)"
                          fill="var(--text-amber)"
                          fillOpacity={0.12}
                          strokeWidth={1.5}
                          isAnimationActive
                          animationBegin={80}
                          animationDuration={600}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Stat values row */}
                  <div className="px-4 pb-3 shrink-0 flex gap-3 justify-center flex-wrap">
                    {STAT_META.map((s) => (
                      <div key={s.key} className="flex items-center gap-1.5">
                        <s.Icon size={10} style={{ color: s.color }} />
                        <span className="font-mono text-[9px] tracking-wider tabular-nums" style={{ color: s.color }}>
                          {s.label} {hero[s.key as keyof Hero] as number}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Mission record */}
                  {total > 0 && (
                    <div className="px-4 py-3 mt-auto shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
                      <p className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                        <span style={{ color: "var(--success)" }}>{hero.missionsCompleted}</span> completed
                        {" · "}
                        <span style={{ color: "var(--danger)" }}>{hero.missionsFailed}</span> failed
                      </p>
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
