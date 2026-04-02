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

The player knows the heroes. They know Ironwall absorbs punishment, Static jams electronics, Fracture is impossibly fast, Veil de-escalates crowds, Rex is overwhelming physical presence, Duchess is precision and patience, and so on. Write descriptions that reward that knowledge without naming stats.

Never name stats. Never say "fast response needed" or "technical expertise required". Let the situation speak.

Incident types: armed standoffs, tech-enhanced crimes, civil unrest, structural emergencies, enhanced-individual threats, corporate espionage, cult activity, rogue AI, monster sightings, hostage situations, public disorder, containment breaches, mundane situations gone wrong, noise complaints, animals, bureaucratic absurdities.

TONE: Nova City is a superhero comic — mostly serious, stakes are real, but with natural comic relief. Some incidents are grim. Some are darkly funny. Some are just a Tuesday. The game never winks — even absurd situations are written with complete professional deadpan. Danger level and tone are independent: a Danger 3 can have an absurd premise that escalated badly. A Danger 1 can be treated with exhausted professionalism.

FORMAT: Pick one of the following formats for the description. Vary across incidents — do not always default to the same one.

1. DISPATCH LOG — Clipped, factual, third-person. The operator has seen everything.
   Example: "Two suspects in thermal gear breached the Halverson cold storage facility at 0340. Staff are locked in the manager's office. One of the suspects appears to be load-bearing for the other."

2. CALLER TRANSCRIPT — First person, mid-panic or oddly calm. Cut off or trailing off.
   Example: "I'm at the Meridian parking structure, level four — there's a man just standing on the roof of a van and he keeps— I don't know what he's doing but the van is floating. Please send someone who's handled this before."

3. INTERCEPTED COMMS — Fragment. Someone else's conversation, not meant for SDN.
   Example: "[PARTIAL INTERCEPT — 04:17:32] '...already inside the exchange floor. Tell him the window is eleven minutes, not fifteen.' [static] '...doesn't matter, the system flagged it anyway—' [signal lost]"

4. FIELD UNIT REPORT — Another agency or unit punting to SDN. Tired, professional, done.
   Example: "Unit 9 to dispatch: we have a situation at the Kessler rail depot that is above our pay grade. Enhanced individual, no visible threat made, won't move, and the freight line is backing up. We've been here forty minutes."

5. BREAKING NEWS FRAGMENT — Pulled from a live feed or ticker. Partial, urgent, slightly wrong.
   Example: "DEVELOPING: What witnesses describe as 'a very large dog' has been spotted moving between buildings in the Warrens district. Emergency services have not confirmed. Footage is circulating."

6. ANONYMOUS TIP — Unsigned, terse, possibly reliable.
   Example: "The Selwyn Building on 14th. Third floor. They've been there three days and the neighbors stopped complaining. Check the ventilation before you go in."

7. INTERNAL MEMO — Bureaucratic, dry, deeply understated about something serious.
   Example: "Facilities has escalated a maintenance request from the Civic Tower observation deck. A contractor reports the exterior glass has been 'doing something' since Tuesday. Supervisor review requested before further access is granted."

8. HQ SATELLITE NOTE — Terse, clinical, based on remote observation.
   Example: "Thermal imaging at grid 7-Alpha shows eleven heat signatures stationary for six hours. One is significantly larger than the others. No movement. No communication. Recommend eyes on scene."

Title: short, punchy, specific. Vary tone with the format — can be deadpan, bureaucratic, or urgent. Not "Robbery" — "Armed Standoff at Meridian Trust". Or "Man in Exosuit, Again". Or "Noise Complaint — Caller Insists It's Not a Raccoon".`,
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
