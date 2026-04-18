"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useGameStore, type LogEntry } from "@/stores/gameStore";

const CRTEffect = dynamic(() => import("vault66-crt-effect"), { ssr: false });

const entryColor: Record<LogEntry["type"], string> = {
  neutral: "var(--text-primary)",
  success: "var(--success)",
  failure: "var(--danger)",
  eval:    "var(--text-amber)",
  system:  "var(--text-dim-warm)",
};

function LogLine({ entry }: { entry: LogEntry }) {
  return (
    <div
      className="font-mono text-xs leading-relaxed animate-fadeIn"
      style={{ color: entryColor[entry.type] }}
    >
      <span className="opacity-40 mr-2 select-none">›</span>
      {entry.message}
    </div>
  );
}

function LogContent() {
  const entries = useGameStore((s) => s.logEntries);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--panel-inset)" }}
    >
      <div
        className="px-3 py-2 text-xs font-mono tracking-widest uppercase border-b shrink-0"
        style={{ color: "var(--text-amber)", borderColor: "var(--border)" }}
      >
        SDN Comms
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-hide">
        {entries.length === 0 && (
          <div
            className="font-mono text-xs opacity-60"
            style={{ color: "var(--text-primary)" }}
          >
            Awaiting dispatch...
          </div>
        )}
        {entries.map((entry) => (
          <LogLine key={entry.id} entry={entry} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export function LogPanel() {
  return (
    <div className="log-crt-wrapper">
      <CRTEffect
        preset="dos"
        theme="amber"
        enableScanlines
        scanlineOpacity={0.08}
        sweepDuration={6}
        enableGlow={false}
        enableEdgeGlow={false}
        enableFlicker={false}
        enableVignette
        vignetteIntensity={0.4}
        enableGlitch={false}
      >
        <LogContent />
      </CRTEffect>
    </div>
  );
}
