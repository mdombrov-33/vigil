import { z } from "zod";

export const statSchema = z.enum([
  "threat",
  "grit",
  "presence",
  "edge",
  "tempo",
]);

// IncidentGeneratorAgent — pure flavor, no game mechanics
export const IncidentGeneratorOutputSchema = z.object({
  title: z.string().describe("Short incident title shown on the map pin"),
  description: z
    .string()
    .describe("2–4 sentence flavor description shown to the player"),
});
export type IncidentGeneratorOutput = z.infer<
  typeof IncidentGeneratorOutputSchema
>;

// TriageAgent — extracts game mechanics from the description
const interruptOptionSchema = z.object({
  id: z.string(),
  text: z.string().describe("Player-facing option text"),
  requiredStat: statSchema,
  requiredValue: z.number().min(1).max(10),
  isHeroSpecific: z
    .boolean()
    .describe("True for the top-hero-only guaranteed-success option"),
});

export const TriageOutputSchema = z.object({
  requiredStats: z
    .record(statSchema, z.number().min(1).max(10))
    .describe("Stats this incident tests and how heavily (1–10)"),
  slotCount: z.number().min(1).max(4).describe("Max hero slots"),
  dangerLevel: z.number().min(1).max(3).describe("1=minor 2=standard 3=major"),
  missionDuration: z.number().describe("Seconds heroes are on scene"),
  expiryDuration: z
    .number()
    .describe("Seconds before the incident expires unresolved"),
  hasInterrupt: z.boolean(),
  interruptOptions: z.array(interruptOptionSchema).optional(),
});
export type TriageOutput = z.infer<typeof TriageOutputSchema>;

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
