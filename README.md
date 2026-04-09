# Vigil

<img src="docs/screens/1.png" width="100%"/>

Superhero dispatcher game with a hidden multi-agent AI system that evaluates your decisions in real time.

You assign heroes to incidents on a city map. While you're doing that, a separate agent pipeline is building its own recommendation silently. After the mission — hero field reports written in character, an eval score, and a verdict on whether your dispatch actually made sense given what the incident needed.

---

## Agents

Eight agents, each with a single job:

- **Session Arc** — generates 2 narrative arc threads and an incident limit at session start; sets the tone for the whole shift
- **Incident Generator** — writes briefings with narrative continuity, advancing arc threads across the session with pacing awareness
- **Triage** — extracts required stats, danger level, slot count, field intel hints, interrupt options
- **Narrative Pick** — picks the hero that fits the story, unlocks a hero-specific interrupt option
- **Dispatcher** — builds a hidden stat-based recommendation before you commit
- **Hero Report** — writes a first-person field report per hero, in their voice, aware of teammates and what happened
- **Reflection** — checks reports against the hero's bio and the incident — rejects off-voice or generic content, triggers a rewrite
- **Eval** — compares your dispatch to the hidden recommendation, scores 0–10, writes the post-op note

---

## Stack

Node.js · TypeScript · Express · PostgreSQL · Drizzle · Next.js · Zustand · OpenAI Agents SDK · MCP · SSE · GCP Cloud Run

---

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screens/2.png"/></td>
    <td width="50%"><img src="docs/screens/3.png"/></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screens/4.png"/></td>
    <td width="50%"><img src="docs/screens/5.png"/></td>
  </tr>
</table>
