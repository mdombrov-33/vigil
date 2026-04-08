import { run, Agent } from "@openai/agents";
import { MODEL_FULL } from "./models.js";
import { mcpServer } from "./mcp.js";
import { HeroReportSchema, type HeroReport } from "./schemas.js";
import type { Hero, Incident } from "@/db/index.js";

export interface MissionContext {
  teammates: string[]; // aliases of other heroes on this mission
  isLead: boolean;     // true if this hero is topHeroId (narrative pick)
  arcName?: string;    // name of the arc thread this incident belongs to, if any
  interrupt?: {
    chosenOptionText: string;
    outcome: "success" | "failure";
  };
}

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
  context: MissionContext,
): Promise<HeroReport> {
  const agent = createHeroReportAgent(hero);

  const teamLine = context.teammates.length > 0
    ? `You were on this mission alongside: ${context.teammates.join(", ")}.${context.isLead ? " You led the operation." : ""}`
    : "You handled this one solo.";

  const arcLine = context.arcName
    ? `This incident is part of an ongoing situation: ${context.arcName}.`
    : "";

  const interruptLine = context.interrupt
    ? `Mid-mission your team faced a critical decision — "${context.interrupt.chosenOptionText}" — it ${context.interrupt.outcome === "success" ? "paid off" : "didn't go as planned"}.`
    : "";

  const result = await run(
    agent,
    `Call get_hero_mission_history with hero_id=${hero.id} and session_id=${incident.sessionId} to recall your missions from this session.
Then write your mission report for the following:

Incident: ${incident.title}
${incident.description}

${teamLine}${arcLine ? `\n${arcLine}` : ""}${interruptLine ? `\n${interruptLine}` : ""}

Outcome: ${outcome.toUpperCase()}

Write in first person, in your voice. HARD LIMIT: 3 sentences maximum — this is a UI card.
Let your character lead. Don't follow a formula. Reference teammates or the interrupt if it adds something real — skip it if it doesn't.
Only reference past missions if get_hero_mission_history returned actual records. If your history is empty, do not invent prior encounters — ground the report in what happened on this mission.`,
  );

  return result.finalOutput as HeroReport;
}
