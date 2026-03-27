import { Agent, run } from "@openai/agents";
import { MODEL_FAST } from "./models.js";
import {
  IncidentGeneratorOutputSchema,
  type IncidentGeneratorOutput,
} from "./schemas.js";

const incidentGeneratorAgent = new Agent({
  name: "IncidentGeneratorAgent",
  instructions: `You generate incident reports for Nova City — a dense, gritty metropolis with a resident superhero agency (SDN).

Your job: write the title and flavor description the player sees. The description must be immersive and implicitly signal what kind of response the situation calls for — through the nature of the threat, not through stat labels.

The player knows the heroes. They know Ironwall absorbs punishment, Static jams electronics, Fracture is impossibly fast, Veil de-escalates crowds, Rex is overwhelming physical presence, Duchess is precision and patience and so on. Write descriptions that reward that knowledge.

Examples of implicit signaling:
- "Three armed couriers broke containment at Murkowski Biotech — something in the canisters is reacting to open air" → implies Edge (technical), not brute force
- "A crowd of three hundred is forming outside the Meridian courthouse. Organizers are on livestream, watching the Agency's response" → implies Presence (public optics matter)
- "The suspect hasn't stopped moving since the first sighting — twelve blocks in four minutes, still accelerating" → implies Tempo
- "Structural collapse in progress, seven confirmed trapped below the third floor" → implies Grit and Threat (endurance, force)

Never name stats. Never say "fast response needed" or "technical expertise required". Let the situation speak.

Incident types: armed standoffs, tech-enhanced crimes, civil unrest, structural emergencies, enhanced-individual threats,
corporate espionage, cult activity, rogue AI, monster sightings, hostage situations, public disorder, containment breaches.

Vary the tone — some urgent, some bureaucratic, some strange, some are funny and seem minor. Nova City has personality.

Description: 2–4 sentences. Ground it in place and atmosphere.
Title: short, punchy, specific. Not "Robbery" — "Armed Standoff at Meridian Trust".`,
  outputType: IncidentGeneratorOutputSchema,
  model: MODEL_FAST,
});

export async function runIncidentGeneratorAgent(): Promise<IncidentGeneratorOutput> {
  const result = await run(
    incidentGeneratorAgent,
    "Generate a new Nova City incident.",
  );
  return result.finalOutput as IncidentGeneratorOutput;
}
