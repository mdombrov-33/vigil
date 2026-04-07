import { Agent, run } from "@openai/agents";
import { MODEL_FULL } from "./models.js";
import { SessionArcOutputSchema, type SessionArcOutput } from "./schemas.js";

export interface HeroBio {
  alias: string;
  bio: string;
}

function buildPrompt(heroBios: HeroBio[]): string {
  const rosterLines = heroBios.map((h) => `- ${h.alias}: ${h.bio}`).join("\n");
  return `Generate narrative threads for a new Nova City shift. Be creative — make this session feel distinct.\n\nHERO ROSTER (for personal arc reference only):\n${rosterLines}`;
}

const sessionArcAgent = new Agent({
  name: "SessionArcAgent",
  instructions: `You design narrative threads for a superhero dispatch shift in Nova City.

A session has 12–20 incidents. Most are standalone. But 1–2 narrative threads weave through the session — recurring situations, escalating threats, or strange phenomena that the player will notice connecting across incidents.

Your job: generate those threads. The incident generator will use them when writing descriptions, weaving references organically. The player never sees these seeds directly — they just notice the world feels connected.

RULES:
- Threads are NOT a rigid script. They are thematic anchors the generator can reference, advance, or ignore depending on pacing.
- A thread advances when the generator decides to reference it — 2–4 times across the session.
- Threads should feel like they belong in a superhero comic: a mix of serious and absurd is fine. The world is consistent.
- Name specific people, places, factions. Vague concepts produce vague incidents.

ARC TYPES — vary wildly across sessions:

VILLAIN/ANTAGONIST: A named individual or faction taking escalating action. They appear, cause trouble, and the session culminates in a confrontation or near-miss. Examples: a fixer named Caleb Marsh quietly acquiring city infrastructure, a powered individual who keeps escaping containment, a corporate exec orchestrating something that looks legal but isn't.

CRISIS CHAIN: No villain — just a situation compounding. A chemical spill that drifts, a structural failure that spreads, a power grid problem creating cascading incidents across the city. Nobody to punch, just problems multiplying.

DIPLOMATIC/POLITICAL ARC: A summit, a trial, a protest — something where public perception and de-escalation matter more than force. Heroes with crowd control and presence are key. Dispatching the wrong person makes it worse.

MYSTERY/PUZZLE: Something strange that doesn't make sense at first. Each incident reveals another piece. By the end the player might understand what happened, or they might not. Examples: a series of thefts where nothing obvious was taken, a rash of people going quiet in the same neighborhood, signals that don't match any known source.

THE ABSURD RECURRING THING: Something mundane that keeps escalating through no one's fault. A confused enhanced individual who doesn't know their own strength. A "harmless" escaped creature that keeps showing up. A bureaucratic situation that somehow keeps becoming an SDN problem. Deadpan and professional throughout.

PERSONAL ARC: Tied to a specific hero from the roster provided in the prompt. Use their bio to ground the arc — a location from their past, a former contact showing up on the wrong side, an old case resurfacing. Set linkedHeroAlias to that hero's alias. CRITICAL: the incident generator must never write this hero as already present on scene. They are in the roster, undeployed. The arc creates situations where their background is relevant — not situations where they have already arrived or are already involved. The connection should surface through context, history, and people/places from their past, not through the hero being physically there.

FACTION WAR: Two factions competing, and SDN keeps getting caught in the middle. Neither is fully wrong. Incidents are collateral damage.

WEIGHTING: At least one arc per session should involve an active threat — a powered individual, organised faction, or escalating crisis that demands superhero-scale response. Not every session needs a classic villain, but not every session should be infrastructure problems and noise complaints either. Aim for variety across sessions but lean toward dramatic over mundane.

OUTPUT NOTES:
- incidentLimit: set based on arc complexity. 2 heavy arcs = ~18 incidents. 1 tight arc + 1 light thread = ~14. 1 short arc = ~12.
- concept: be specific. Give the generator actual detail to work with — names, locations, tone, what each beat might look like. Don't be vague.
- tone: match each arc's actual feel. A crisis chain is "serious". A confused giant raccoon situation is "absurd".
- arcType: always set to the matching type from the list above.
- linkedHeroAlias: set to the hero's alias for personal arcs, null for everything else.`,
  outputType: SessionArcOutputSchema,
  model: MODEL_FULL,
});

export async function runSessionArcAgent(heroBios: HeroBio[]): Promise<SessionArcOutput> {
  const result = await run(sessionArcAgent, buildPrompt(heroBios));
  return result.finalOutput as SessionArcOutput;
}
