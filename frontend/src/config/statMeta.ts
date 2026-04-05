import { Flame, Shield, Eye, Cpu, Zap, type LucideIcon } from "lucide-react";

export interface StatMeta {
  key: "threat" | "grit" | "presence" | "edge" | "tempo";
  label: string;
  abbr: string;
  color: string;
  Icon: LucideIcon;
}

export const STAT_META: StatMeta[] = [
  { key: "threat",   label: "Threat",   abbr: "THR", color: "#ef4444", Icon: Flame  },
  { key: "grit",     label: "Grit",     abbr: "GRT", color: "#f97316", Icon: Shield },
  { key: "presence", label: "Presence", abbr: "PRS", color: "#a78bfa", Icon: Eye    },
  { key: "edge",     label: "Edge",     abbr: "EDG", color: "#60a5fa", Icon: Cpu    },
  { key: "tempo",    label: "Tempo",    abbr: "TMP", color: "#34d399", Icon: Zap    },
];

export const STAT_META_BY_KEY = Object.fromEntries(
  STAT_META.map((s) => [s.key, s])
) as Record<StatMeta["key"], StatMeta>;
