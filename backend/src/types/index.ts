export type { Hero, Incident, Mission, Session, NewMission } from "@/db/index.js";

export type Stat = "threat" | "grit" | "presence" | "edge" | "tempo";
export type StatMap = Record<Stat, number>;
export type RequiredStats = Partial<StatMap>;
