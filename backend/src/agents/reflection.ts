import { Agent, run } from "@openai/agents";
import { MODEL_FAST } from "./models.js";
import { ReflectionOutputSchema, type ReflectionOutput } from "./schemas.js";
import type { Hero, Incident } from "@/db/index.js";

const reflectionAgent = new Agent({
  name: "ReflectionAgent",
  instructions: `You are a quality reviewer for the SDN mission reporting system.

Evaluate mission reports written by hero agents. Approve reports that:
- Stay in character (voice matches the hero's established personality)
- Address the incident specifically — not generic
- Match the stated outcome (success vs failure should feel different)
- Are exactly 3 sentences or fewer

Reject and rewrite ONLY for: wrong voice, generic content, or outcome mismatch. Do NOT reject for length — 3 sentences is correct. If rewriting, match the hero's voice and stay within 3 sentences.`,
  outputType: ReflectionOutputSchema,
  model: MODEL_FAST,
});

export async function runReflectionAgent(
  report: string,
  hero: Hero,
  outcome: "success" | "failure",
  incident: Incident,
): Promise<string> {
  let current = report;

  for (let i = 0; i < 2; i++) {
    const result = await run(
      reflectionAgent,
      `Hero: ${hero.alias} (${hero.name})
Hero bio: ${hero.bio}

Incident: ${incident.title}
Incident description: ${incident.description}
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
