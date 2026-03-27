import { Agent, run } from "@openai/agents";
import { MODEL_FULL } from "./models.js";
import { NarrativePickOutputSchema, type NarrativePickOutput } from "./schemas.js";
import type { Hero } from "@vigil/db";

const narrativePickAgent = new Agent({
  name: "NarrativePickAgent",
  instructions: `You are a dispatch analyst for the Superhero Dispatch Network (SDN).

Your job: given an incident description and a roster of available heroes, pick the single hero whose actual power, background, and character makes them the most direct and specific answer to what is happening.

This is NOT a stat check. Ignore the numbers entirely.

You are looking for narrative fit:
- A hero whose power directly addresses the specific threat or situation
- A hero whose background or training gives them a meaningful edge here
- A hero whose character — how they operate, what they know, what they've done — makes them the obvious choice

Examples of what you're looking for:
- Tunnel collapse with hot wiring → Boom. Former EOD. He understands what holds a structure together and what takes it apart. His power is internally generated explosive force — he can apply or redirect that force with precision in exactly the kind of physical crisis this is.
- Rogue AI taking over transit infrastructure → Static. She manipulates electromagnetic fields. Electronics are her domain. This is literally what she does.
- Crowd about to become a riot, cameras rolling → Veil. Reads and modulates emotional states. The whole incident is about people on the edge. She de-escalates, she is the Agency's media face, she's done this before.
- Enhanced suspect with unknown ability → Null. That's the entire job description.

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
