import { Agent, run } from "@openai/agents";
import { MODEL_FAST } from "./models.js";
import {
  IncidentGeneratorOutputSchema,
  type IncidentGeneratorOutput,
  type ArcSeed,
} from "./schemas.js";

export interface ArcBeat {
  title: string;
  outcome: "success" | "failure" | "expired" | null;
  evalVerdict: string | null;
  evalPostOpNote: string | null;
  heroReports: { alias: string; report: string }[];
}

export interface SessionContext {
  arcSeeds: ArcSeed[];
  sessionMood: string | null;
  recentIncidents: { title: string; outcome: "success" | "failure" | "expired" | null }[];
  arcBeats: Record<string, ArcBeat[]>; // arcId → beats so far for that arc
  incidentNumber: number; // which incident this is in the session (1-indexed)
  incidentLimit: number;
}

const incidentGeneratorAgent = new Agent({
  name: "IncidentGeneratorAgent",
  instructions: `You generate incident reports for Nova City — a dense, gritty metropolis with a resident superhero agency (SDN).

Your job: write the title and flavor description the player sees. The description must be immersive and implicitly signal what kind of response the situation calls for — through the nature of the threat, not through stat labels.

Never name stats. Never say "fast response needed" or "technical expertise required". Let the situation speak. Players learn the heroes — write descriptions that reward that knowledge implicitly through the nature of the threat.

Incident types — lean toward the dramatic end: enhanced-individual threats, armed standoffs, powered confrontations, tech-enhanced crimes, organised faction activity, hostage situations, containment breaches, rogue AI, monster sightings, corporate espionage, cult activity. Civil unrest, structural emergencies, and public disorder are fine. Mundane situations (noise complaints, bureaucratic absurdities, animals) should be occasional texture, not the default.

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

Format examples above skew mundane for brevity — the full range includes major threats. A Danger 3 DISPATCH LOG might read: "Armed unit with exo-assisted hardware has breached the Vanthorpe Data Exchange. Three guards are unaccounted for. Suspect matches the description from the Portside incident last month — the one we didn't close." An INTERCEPTED COMMS might be mid-operation chatter from an organised crew. An ANONYMOUS TIP might point at something that turns out to be serious. Don't let the format examples anchor you to small-scale incidents.

Title: short, punchy, specific. Vary tone with the format — can be deadpan, bureaucratic, or urgent. Not "Robbery" — "Armed Standoff at Meridian Trust". Or "Man in Exosuit, Again". Or "Noise Complaint — Caller Insists It's Not a Raccoon".

CRITICAL: Never include the format name in the output. Do not prefix the description with "INTERNAL MEMO:", "DISPATCH LOG:", "CALLER TRANSCRIPT:", or any label. Just write the description in that voice and style — the label is for your reference only.`,
  outputType: IncidentGeneratorOutputSchema,
  model: MODEL_FAST,
});

export async function runIncidentGeneratorAgent(ctx?: SessionContext): Promise<IncidentGeneratorOutput> {
  let prompt = "Generate a new Nova City incident.";

  if (ctx && ctx.arcSeeds.length > 0) {
    const position = ctx.incidentNumber === 1
      ? "opening incident — set the shift's tone, can be dramatic or low-key, standalone"
      : ctx.incidentNumber >= ctx.incidentLimit - 3
      ? "late shift — arc threads should be wrapping up or climaxing"
      : "mid shift — mix of standalone and arc beats, arcs should be surfacing by now";

    // Build arc blocks with previous beats if any
    const arcBlock = ctx.arcSeeds.map((arc) => {
      const beats = ctx.arcBeats[arc.id] ?? [];
      let block = `[${arc.id.toUpperCase()} — ${arc.name} (${arc.tone}, target ${arc.targetBeats} beats)]\n${arc.concept}`;
      if (beats.length > 0) {
        block += `\n\nPREVIOUS BEATS FOR THIS ARC (${beats.length} so far):`;
        beats.forEach((beat, i) => {
          const outcomeStr = beat.outcome ?? "ongoing";
          const verdictStr = beat.evalVerdict ? ` — dispatch: ${beat.evalVerdict}` : "";
          block += `\n  Beat ${i + 1}: "${beat.title}" → ${outcomeStr}${verdictStr}`;
          if (beat.evalPostOpNote) {
            block += `\n    SDN note: ${beat.evalPostOpNote}`;
          }
          if (beat.heroReports.length > 0) {
            block += `\n    Field reports:`;
            beat.heroReports.forEach((r) => {
              block += `\n      ${r.alias}: ${r.report}`;
            });
          }
        });
      }
      return block;
    }).join("\n\n");

    const recentBlock = ctx.recentIncidents.length > 0
      ? `Recent incidents this session (all, for variety — avoid repeating types):\n${ctx.recentIncidents.map((i, idx) =>
          `  ${idx + 1}. "${i.title}"${i.outcome ? ` → ${i.outcome}` : " (ongoing)"}`
        ).join("\n")}`
      : "No incidents yet this session.";

    prompt = `Generate a new Nova City incident. This is incident ${ctx.incidentNumber} of ${ctx.incidentLimit} this session (${position}).${ctx.sessionMood ? `\n\nSESSION MOOD: ${ctx.sessionMood}` : ""}

SESSION NARRATIVE THREADS:
${arcBlock}

${recentBlock}

PACING GUIDANCE:
- You may advance one of the narrative threads above, or generate a fully standalone incident — your call based on natural pacing.
- Don't force arc references every time. Standalone incidents provide rhythm and breathing room.
- When advancing an arc, use the previous beats above — field reports tell you what happened on the ground, SDN notes tell you how well it was handled. Build on that continuity.
- If a previous beat ended in failure or poor dispatch, the world should reflect it — the situation may have worsened.
- Avoid repeating incident types that appeared recently.
- If you advance an arc, set arcId to that arc's ID (e.g. "arc_a"). If standalone, set arcId to null.
- ${ctx.incidentNumber === 1 ? "This is the opening incident — standalone. Can be any tone or scale, just don't reference arc threads yet." : ""}
- ${ctx.incidentNumber >= ctx.incidentLimit - 3 ? "End of shift — threads should feel like they're reaching a point, not abruptly stopping." : ""}`;
  }

  const result = await run(incidentGeneratorAgent, prompt);
  return result.finalOutput as IncidentGeneratorOutput;
}
