"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface Props {
  onStart: () => Promise<void>;
}

export function StartScreen({ onStart }: Props) {
  const [starting, setStarting] = useState(false);

  async function handleStart() {
    setStarting(true);
    await onStart();
  }

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      style={{ backgroundColor: "var(--background)" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Map background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/map.webp')", opacity: 0.15 }}
      />
      {/* Vignette — edges darken, center stays clear */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 25%, #0a090888 70%, #0a0908dd 100%)" }}
      />
      {/* Horizontal scan lines — subtle texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, #00000012 3px, #00000012 4px)",
          opacity: 0.4,
        }}
      />

      {/* Corner brackets */}
      {[
        { top: 24, left: 24, style: { borderTop: "1px solid #f0a80040", borderLeft: "1px solid #f0a80040" } },
        { top: 24, right: 24, style: { borderTop: "1px solid #f0a80040", borderRight: "1px solid #f0a80040" } },
        { bottom: 24, left: 24, style: { borderBottom: "1px solid #f0a80040", borderLeft: "1px solid #f0a80040" } },
        { bottom: 24, right: 24, style: { borderBottom: "1px solid #f0a80040", borderRight: "1px solid #f0a80040" } },
      ].map((pos, i) => (
        <span
          key={i}
          className="absolute pointer-events-none"
          style={{ width: 20, height: 20, ...pos }}
        />
      ))}

      <div className="relative flex flex-col items-center" style={{ gap: 32 }}>

        {/* Title block */}
        <motion.div
          className="flex flex-col items-center"
          style={{ gap: 10 }}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
        >
          <div
            className="font-mono tracking-[0.5em] uppercase"
            style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.5em" }}
          >
            Superhero Dispatch Network
          </div>

          <h1
            className="font-mono font-bold uppercase"
            style={{
              fontSize: 88,
              lineHeight: 1,
              letterSpacing: "0.12em",
              color: "var(--text-amber)",
              textShadow: "0 0 40px #f0a80060, 0 0 80px #f0a80025",
            }}
          >
            VIGIL
          </h1>

          <div
            className="w-full"
            style={{ height: 1, background: "linear-gradient(to right, transparent, #f0a80060, transparent)" }}
          />
        </motion.div>

        {/* Briefing */}
        <motion.div
          className="font-mono text-center leading-relaxed"
          style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 280 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          Incidents are active across the city.<br />
          Dispatch your heroes before the situation deteriorates.
        </motion.div>

        {/* Start button */}
        <motion.button
          onClick={handleStart}
          disabled={starting}
          className="font-mono uppercase tracking-widest transition-all"
          style={{
            fontSize: 11,
            letterSpacing: "0.3em",
            padding: "12px 48px",
            border: `1px solid ${starting ? "var(--amber-border)" : "#f0a80080"}`,
            color: starting ? "var(--text-muted)" : "var(--text-amber)",
            backgroundColor: starting ? "var(--amber-glow)" : "transparent",
            cursor: starting ? "default" : "pointer",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          whileHover={starting ? {} : { backgroundColor: "var(--amber-glow)", borderColor: "var(--text-amber)" }}
          whileTap={starting ? {} : { scale: 0.98 }}
        >
          {starting ? "Initializing..." : "Start Shift"}
        </motion.button>

      </div>
    </motion.div>
  );
}
