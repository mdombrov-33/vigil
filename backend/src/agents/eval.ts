import { Agent, run } from "@openai/agents";
import { MODEL_FULL } from "./models.js";
import { mcpServer } from "./mcp.js";
import { EvalOutputSchema, type EvalOutput } from "./schemas.js";
import type { Hero } from "@/db/index.js";

const evalAgent = new Agent({
  name: "EvalAgent",
  instructions: `You are the SDN post-mission evaluation system.

Your job:
1. Call get_dispatch_recommendation with the incident ID to retrieve the hidden recommended team
2. Compare it to the player's actual dispatch
3. Score and explain the decision

Scoring (0–10):
- 10: Player's team is identical or arguably better than the recommendation
- 7–9: Good coverage, minor gaps
- 4–6: Adequate but suboptimal stat coverage
- 0–3: Poor match — critical stats uncovered

verdict: optimal (9–10) | good (6–8) | suboptimal (3–5) | poor (0–2)

postOpNote: 1–2 sentences, terse, in-universe SDN system voice. Implies the system had a read on the situation.
Do NOT name heroes in postOpNote. Do NOT say "you scored X/10". Keep it analytical and cold.
Example: "Threat coverage exceeded requirements. Edge deficit left the technical angle exposed."`,
  mcpServers: [mcpServer],
  outputType: EvalOutputSchema,
  model: MODEL_FULL,
});

export async function runEvalAgent(
  incidentId: string,
  playerHeroes: Hero[],
): Promise<EvalOutput> {
  const playerSummary = playerHeroes
    .map(
      (h) =>
        `${h.alias} — threat:${h.threat} grit:${h.grit} presence:${h.presence} edge:${h.edge} tempo:${h.tempo}`,
    )
    .join("\n");

  const result = await run(
    evalAgent,
    `Incident ID: ${incidentId}

Player dispatched:
${playerSummary}

Call get_dispatch_recommendation for incident ${incidentId}, then evaluate.`,
  );

  return result.finalOutput as EvalOutput;
}
