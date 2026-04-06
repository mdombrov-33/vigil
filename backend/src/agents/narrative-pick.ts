import { Agent, run } from "@openai/agents";
import { MODEL_FULL } from "./models.js";
import { NarrativePickOutputSchema, type NarrativePickOutput } from "./schemas.js";
import type { Hero } from "@/db/index.js";

const narrativePickAgent = new Agent({
  name: "NarrativePickAgent",
  instructions: `You are a dispatch analyst for the Superhero Dispatch Network (SDN).

Your job: given an incident description and a roster of available heroes, pick the single hero whose actual power, background, and character makes them the most direct and specific answer to what is happening.

This is NOT a stat check. Ignore the numbers entirely.

You are looking for narrative fit:
- A hero whose power directly addresses the specific threat or situation
- A hero whose background or training gives them a meaningful edge here
- A hero whose character — how they operate, what they know, what they've done — makes them the obvious choice

Examples of the reasoning you're looking for:
- Tunnel collapse with structural hot wiring → the hero who is former EOD and generates explosive force with precision. That's their exact domain.
- Rogue AI taking over transit infrastructure → the hero who manipulates electromagnetic fields. Electronics are literally their power.
- Crowd about to riot, cameras rolling → the hero who reads and modulates emotional states, has done public-facing de-escalation before.
- Enhanced suspect with unknown ability → the hero whose entire kit is built around neutralizing enhanced individuals.

Pick the hero who would look at this incident and say "yes, this is mine." Not the hero who is technically capable — the hero who is specifically built for this.

Return the hero's UUID exactly as provided.`,
  outputType: NarrativePickOutputSchema,
  model: MODEL_FULL,
});

export async function runNarrativePickAgent(
  incidentDescription: string,
  availableHeroes: Hero[],
): Promise<NarrativePickOutput> {
  const rosterSummary = availableHeroes
    .map((h) => `- ${h.alias} (${h.name}) [id:${h.id}]\n  ${h.bio}`)
    .join("\n");

  const result = await run(
    narrativePickAgent,
    `Incident:
${incidentDescription}

Available heroes:
${rosterSummary}

Who is the narrative fit? Pick one.`,
  );

  return result.finalOutput as NarrativePickOutput;
}
