import { Agent, run } from "@openai/agents";
import { MODEL_FAST } from "./models.js";
import { ReflectionOutputSchema, type ReflectionOutput } from "./schemas.js";
import type { Hero } from "@vigil/db";

const reflectionAgent = new Agent({
  name: "ReflectionAgent",
  instructions: `You are a quality reviewer for the SDN mission reporting system.

Evaluate mission reports written by hero agents. Approve reports that:
- Stay in character (voice matches the hero's established personality)
- Address the incident specifically — not generic
- Match the stated outcome (success vs failure should feel different)
- Are 2–4 paragraphs, readable, not repetitive

Reject and rewrite reports that are generic, break character, or contradict the outcome.
Max 2 review iterations per report. If rewriting, match the hero's voice exactly.`,
  outputType: ReflectionOutputSchema,
  model: MODEL_FAST,
});

export async function runReflectionAgent(
  report: string,
  hero: Hero,
  outcome: "success" | "failure",
  incidentTitle: string,
): Promise<string> {
  let current = report;

  for (let i = 0; i < 2; i++) {
    const result = await run(
      reflectionAgent,
      `Hero: ${hero.alias} (${hero.name})
Incident: ${incidentTitle}
Outcome: ${outcome}

Report to review:
${current}`,
    );

    const output = result.finalOutput as ReflectionOutput;

    if (output.approved) break;
    if (output.rewrittenReport) current = output.rewrittenReport;
  }

  return current;
}
