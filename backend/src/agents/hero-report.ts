import { run, Agent } from "@openai/agents";
import { MODEL_FULL } from "./models.js";
import { mcpServer } from "./mcp.js";
import { HeroReportSchema, type HeroReport } from "./schemas.js";
import type { Hero, Incident } from "@vigil/db";

export function createHeroReportAgent(hero: Hero) {
  return new Agent({
    name: `HeroAgent_${hero.alias}`,
    instructions: hero.personality,
    mcpServers: [mcpServer],
    outputType: HeroReportSchema,
    model: MODEL_FULL,
  });
}

export async function runHeroReportAgent(
  hero: Hero,
  outcome: "success" | "failure",
  incident: Incident,
): Promise<HeroReport> {
  const agent = createHeroReportAgent(hero);

  const result = await run(
    agent,
    `Call get_hero_mission_history with your hero ID (${hero.id}) to recall your last missions.
Then write your mission report for the following:

Incident: ${incident.title}
${incident.description}

Outcome: ${outcome.toUpperCase()}

Write in first person, in your voice. Reference the incident specifics. HARD LIMIT: 3 sentences maximum. No exceptions — this is a UI card, not a report. One sentence setup, one sentence what you did, one sentence outcome or closing thought.
Your mission history is context for continuity — reference past events only if it adds something in one of those 3 sentences.`,
  );

  return result.finalOutput as HeroReport;
}
