import { Agent, run } from "@openai/agents";
import { MODEL_FAST } from "./models.js";
import { TriageOutputSchema, type TriageOutput } from "./schemas.js";

const triageAgent = new Agent({
  name: "TriageAgent",
  instructions: `You are a crisis analyst for the Superhero Dispatch Network (SDN).

Given a raw incident description, extract the structured game data that determines how this mission plays out.

Rules:
- requiredStats: pick 1–3 stats most relevant to the incident type. Weights 1–10 reflect how critical each stat is.
  threat = physical force, grit = durability, presence = charisma/crowd control, edge = intelligence/tech, tempo = speed/agility
- slotCount: how many heroes the incident warrants (1 = minor solo job, 4 = major crisis)
- dangerLevel: 1=minor (green), 2=standard (yellow), 3=major (red)
- missionDuration: time heroes spend on scene in seconds. Minor ~30s, standard ~60s, major ~90–120s
- expiryDuration: time before incident expires unresolved. Minor ~60s, standard ~120s, major ~180s
- hasInterrupt: true for dramatic mid-mission decision points. Not every incident needs one.
- interruptOptions: if hasInterrupt, provide 2–4 options. Exactly one must have isHeroSpecific=true — guaranteed success if the top hero was dispatched, no stat check needed, do NOT set requiredStat/requiredValue on it. All other options must have requiredStat and requiredValue. All option text must read as a plain action description — never reference "your hero", "if you sent", or any meta-game language. Same tone as the other options.

Be consistent. A bank robbery with armed gunmen needs threat + grit. A hostage negotiation needs presence + edge.`,
  outputType: TriageOutputSchema,
  model: MODEL_FAST,
});

export async function runTriageAgent(description: string): Promise<TriageOutput> {
  const result = await run(triageAgent, description);
  return result.finalOutput as TriageOutput;
}
