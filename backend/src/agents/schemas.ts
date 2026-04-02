import { z } from "zod";

export const statSchema = z.enum([
  "threat",
  "grit",
  "presence",
  "edge",
  "tempo",
]);

// SessionArcAgent — generates narrative threads for a session
export const ArcSeedSchema = z.object({
  id: z.string().describe("Short identifier: arc_a, arc_b"),
  name: z.string().describe("Name of this thread — a faction, person, situation, or phenomenon"),
  concept: z.string().describe("Rich description for the incident generator to use when advancing this thread. Include tone, escalation pattern, what changes across beats, any named NPCs or locations."),
  tone: z.string().describe("The emotional register of this arc — e.g. 'serious', 'absurd', 'tense', 'darkly comic', 'bureaucratic nightmare'. Freeform."),
  targetBeats: z.number().min(2).max(4).describe("How many incidents across the session should reference this thread"),
});
export type ArcSeed = z.infer<typeof ArcSeedSchema>;

export const SessionArcOutputSchema = z.object({
  arcs: z.array(ArcSeedSchema).min(1).max(2).describe("1–2 narrative threads for this session. Can be wildly different types."),
  incidentLimit: z.number().min(12).max(20).describe("Total incidents to spawn this session. Scaled to arc complexity."),
  sessionMood: z.string().describe("One sentence flavor note on the overall session feel — used as context only, not shown to player."),
});
export type SessionArcOutput = z.infer<typeof SessionArcOutputSchema>;

// IncidentGeneratorAgent — pure flavor, no game mechanics
export const IncidentGeneratorOutputSchema = z.object({
  title: z.string().describe("Short incident title shown on the map pin"),
  description: z
    .string()
    .describe("2–4 sentence flavor description shown to the player"),
  arcId: z
    .string()
    .nullable()
    .describe("Which arc this incident advances — must match one of the arc IDs from the session seeds (e.g. 'arc_a', 'arc_b'). Null if this is a standalone incident."),
});
export type IncidentGeneratorOutput = z.infer<
  typeof IncidentGeneratorOutputSchema
>;

// TriageAgent — extracts game mechanics from the description
const interruptOptionSchema = z.object({
  id: z.string(),
  text: z.string().describe("Player-facing option text"),
  isHeroSpecific: z
    .boolean()
    .describe(
      "True for the top-hero-only option — no stat check, guaranteed success if that hero was sent",
    ),
  requiredStat: statSchema
    .optional()
    .describe("Only set when isHeroSpecific is false"),
  requiredValue: z
    .number()
    .min(1)
    .max(10)
    .optional()
    .describe("Only set when isHeroSpecific is false"),
});

export const TriageOutputSchema = z.object({
  requiredStats: z
    .object({
      threat: z.number().min(1).max(10),
      grit: z.number().min(1).max(10),
      presence: z.number().min(1).max(10),
      edge: z.number().min(1).max(10),
      tempo: z.number().min(1).max(10),
    })
    .partial()
    .describe("Stats this incident tests and how heavily (1–10). Only include relevant stats."),
  hints: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe("2–3 short field intel notes for the player. Implicitly signal required stats without naming them. Ambiguous but accurate."),
  slotCount: z.number().min(1).max(4).describe("Max hero slots"),
  dangerLevel: z.number().min(1).max(3).describe("1=minor 2=standard 3=major"),
  missionDuration: z.number().describe("Seconds heroes are on scene"),
  expiryDuration: z
    .number()
    .describe("Seconds before the incident expires unresolved"),
  hasInterrupt: z.boolean(),
  interruptTrigger: z
    .string()
    .optional()
    .describe("One sentence in dispatch voice describing what happened mid-mission to force this decision. Past tense. Only set when hasInterrupt is true. Example: 'A secondary device was found wired to the main panel as the team moved to secure the floor.'"),
  interruptOptions: z.array(interruptOptionSchema).optional(),
});
export type TriageOutput = z.infer<typeof TriageOutputSchema>;

// NarrativePickAgent — picks the top-1 hero based on narrative/power fit
export const NarrativePickOutputSchema = z.object({
  heroId: z.uuid().describe("UUID of the hero whose power and background best fits this incident"),
  reasoning: z.string().describe("Why this hero is the narrative fit — power, background, character"),
});
export type NarrativePickOutput = z.infer<typeof NarrativePickOutputSchema>;

// HeroAgent — in-character mission report
export const HeroReportSchema = z.object({
  report: z.string().describe("First-person in-character mission report"),
});
export type HeroReport = z.infer<typeof HeroReportSchema>;

// ReflectionAgent — evaluates and optionally rewrites the hero report
export const ReflectionOutputSchema = z.object({
  approved: z.boolean(),
  rewrittenReport: z
    .string()
    .optional()
    .describe("Only present if approved is false"),
  feedback: z.string().describe("Internal quality notes"),
});
export type ReflectionOutput = z.infer<typeof ReflectionOutputSchema>;

// EvalAgent — compares player dispatch to hidden recommendation
export const EvalOutputSchema = z.object({
  score: z.number().min(0).max(10),
  verdict: z.enum(["optimal", "good", "suboptimal", "poor"]),
  explanation: z
    .string()
    .describe("Internal explanation of scoring — not shown directly to player"),
  postOpNote: z
    .string()
    .describe(
      "Terse in-universe SDN system note shown in the log panel. Implies the system had a take without naming heroes or giving a grade.",
    ),
});
export type EvalOutput = z.infer<typeof EvalOutputSchema>;
