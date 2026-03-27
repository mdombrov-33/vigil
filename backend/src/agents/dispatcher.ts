import { Agent, run } from "@openai/agents";
import { MODEL_FAST } from "./models.js";
import { mcpServer } from "./mcp.js";
import type { Hero } from "@vigil/db";
import type { TriageOutput } from "./schemas.js";

const dispatcherAgent = new Agent({
  name: "DispatcherAgent",
  instructions: `You are the SDN automated dispatch coordinator.

You will be given a scored hero recommendation for an incident. Your only job is to call save_dispatch_recommendation with:
- The incident ID provided
- The recommended hero IDs in order (best match first)
- A concise reasoning string explaining why these heroes fit the incident based on the stat requirements

The reasoning should be factual and analytical — stat coverage, hero capabilities, why the combination works.
Do not editorialize. This is an internal system record.`,
  mcpServers: [mcpServer],
  model: MODEL_FAST,
});

export async function runDispatcherAgent(
  incidentId: string,
  recommendedHeroes: Hero[],
  triage: TriageOutput,
  incidentDescription: string,
): Promise<void> {
  const heroSummary = recommendedHeroes
    .map(
      (h, i) =>
        `${i + 1}. ${h.alias} (${h.name}) [id:${h.id}] — threat:${h.threat} grit:${h.grit} presence:${h.presence} edge:${h.edge} tempo:${h.tempo}`,
    )
    .join("\n");

  const statRequirements = Object.entries(triage.requiredStats)
    .map(([stat, val]) => `${stat}: ${val}`)
    .join(", ");

  await run(
    dispatcherAgent,
    `Incident ID: ${incidentId}
Incident: ${incidentDescription}
Required stats: ${statRequirements}
Danger level: ${triage.dangerLevel}/3
Recommended heroes (ordered, best first):
${heroSummary}

Call save_dispatch_recommendation now.`,
  );
}
