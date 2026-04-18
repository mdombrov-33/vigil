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

const STAT_MAX = 100;

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
                <div className="absolute inset-0" style={{ background: "linear-gradient(to right, transparent 65%, var(--panel) 100%)" }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--panel) 0%, transparent 35%)" }} />

                {hBadge && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[14px] flex items-center justify-center z-10"
                    style={{
                      background: health === "down"
                        ? "repeating-linear-gradient(135deg, var(--danger) 0 8px, #1a1410 8px 16px)"
                        : "repeating-linear-gradient(135deg, var(--warning) 0 8px, #1a1410 8px 16px)",
                      fontFamily: "var(--font-geist-mono)",
                      fontWeight: 700,
                      fontSize: 8,
                      letterSpacing: "0.24em",
                      color: "#e8dfc9",
                    }}
                  >
                    {hBadge.label}
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 26,
                      lineHeight: 1,
                      letterSpacing: "0.02em",
                      textTransform: "uppercase",
                      color: "var(--text-amber)",
                    }}
                  >
                    {hero.alias}
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

              <div className="flex-1 flex flex-col overflow-hidden" style={{ borderLeft: "1px solid var(--border)" }}>

                <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
                    {aBadge && (
                      <span
                        className="font-mono text-[8px] tracking-widest px-2 py-0.5"
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
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col">

                  {hero.bio && (
                    <div className="px-4 pt-3 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                      <p
                        className="leading-relaxed"
                        style={{
                          fontFamily: "var(--font-serif)",
                          fontSize: 14,
                          color: "var(--text-primary)",
                        }}
                      >
                        {hero.bio}
                      </p>
                    </div>
                  )}

                  <div className="px-4 py-4 shrink-0 grid gap-4 items-center" style={{ gridTemplateColumns: "160px 1fr" }}>
                    <div style={{ height: 160, pointerEvents: "none" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData} outerRadius="72%">
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
                            fillOpacity={0.14}
                            strokeWidth={1.5}
                            isAnimationActive
                            animationBegin={80}
                            animationDuration={600}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex flex-col gap-2">
                      {STAT_META.map((s) => {
                        const v = hero[s.key as keyof Hero] as number;
                        const pct = Math.max(0, Math.min(100, (v / STAT_MAX) * 100));
                        return (
                          <div
                            key={s.key}
                            className="grid items-center gap-2"
                            style={{ gridTemplateColumns: "70px 1fr 28px" }}
                          >
                            <span
                              className="font-mono tracking-widest"
                              style={{ color: "var(--text-muted)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase" }}
                            >
                              {s.label}
                            </span>
                            <div
                              className="relative h-2"
                              style={{ backgroundColor: "var(--panel-inset)", border: "1px solid var(--border)" }}
                            >
                              <div
                                className="absolute left-0 top-0 h-full"
                                style={{ width: `${pct}%`, backgroundColor: s.color }}
                              />
                            </div>
                            <span
                              className="font-mono tabular-nums"
                              style={{ color: "var(--text-amber)", fontSize: 10, fontWeight: 700, textAlign: "right" }}
                            >
                              {v}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {total > 0 && (
                    <div className="px-4 py-3 mt-auto shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
                      <p className="font-mono text-[9px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                        <span style={{ color: "var(--success)" }}>{hero.missionsCompleted}</span> COMPLETED
                        {" · "}
                        <span style={{ color: "var(--danger)" }}>{hero.missionsFailed}</span> FAILED
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
