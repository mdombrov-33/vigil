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
      className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-10"
      style={{ backgroundColor: "#08080f" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Map background, dimmed */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: "url('/map.webp')" }}
      />

      <div className="relative flex flex-col items-center gap-8">
        {/* Title */}
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="font-mono text-xs tracking-[0.4em] uppercase" style={{ color: "#fbbf2460" }}>
            Superhero Dispatch Network
          </div>
          <h1 className="font-mono text-5xl font-bold tracking-[0.15em] uppercase" style={{ color: "#fbbf24" }}>
            VIGIL
          </h1>
          <div className="h-px w-48 mt-1" style={{ background: "linear-gradient(to right, transparent, #fbbf2460, transparent)" }} />
        </motion.div>

        {/* Briefing text */}
        <motion.div
          className="font-mono text-xs text-center max-w-xs leading-relaxed"
          style={{ color: "#ffffff40" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          Incidents are active across the city.<br />
          Dispatch your team before the situation deteriorates.
        </motion.div>

        {/* Start button */}
        <motion.button
          onClick={handleStart}
          disabled={starting}
          className="font-mono text-sm tracking-[0.3em] uppercase px-10 py-3 transition-all"
          style={{
            border: "1px solid #fbbf2460",
            color: starting ? "#fbbf2460" : "#fbbf24",
            backgroundColor: starting ? "#fbbf2410" : "transparent",
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          whileHover={{ backgroundColor: "#fbbf2415", borderColor: "#fbbf24" }}
          whileTap={{ scale: 0.97 }}
        >
          {starting ? "Initializing..." : "Start Shift"}
        </motion.button>
      </div>
    </motion.div>
  );
}
