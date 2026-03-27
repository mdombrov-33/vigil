# Vigil — Incident Dispatcher

> Last updated: 2026-03-27

Web game where the player dispatches superheroes to incidents on a city map. A hidden multi-agent system analyzes each incident and forms its own recommendation — revealed only after the player dispatches.

---

## Stack

| Layer             | Tech                                                 |
| ----------------- | ---------------------------------------------------- |
| Backend           | Node.js + TypeScript (Express)                       |
| Frontend          | Next.js (TypeScript)                                 |
| Agents            | OpenAI Agents SDK (TypeScript)                       |
| Schema validation | Zod + `zodResponseFormat`                            |
| ORM               | Drizzle ORM                                          |
| Database          | PostgreSQL                                           |
| MCP Server        | Custom service (separate process, same Docker stack) |
| Streaming         | SSE via backend route handler                        |
| Observability     | OpenAI Agents SDK built-in traces; Langfuse optional |
| Env validation    | t3-env or Zod                                        |
| Deploy            | AWS (backend + MCP + RDS), Vercel (frontend)         |
| Local dev         | Docker Compose                                       |

---

## Repo Structure

```
vigil/
├── backend/
│   └── src/
│       ├── agents/        # One file per agent
│       ├── db/            # Drizzle schema + query functions (db layer)
│       ├── routes/        # Thin route definitions only
│       ├── handlers/      # Business logic, called by routes
│       ├── services/      # Pure logic — outcome calc, cooldowns, scoring
│       └── types/         # Shared TypeScript types
├── mcp-server/            # Separate process, same Docker Compose stack
│   └── src/
│       └── tools/         # One file per MCP tool
├── frontend/
│   └── src/
│       ├── app/           # Next.js App Router
│       ├── components/    # Map, RosterBar, modals, LogPanel
│       └── types/
└── docker-compose.yml     # Postgres + backend + mcp-server for local dev
```

**Layering rules:**

- `route → handler → service / db` — routes are thin wiring only
- Handlers call db layer (Drizzle functions) and services
- Services are pure logic, no db calls
- Agents call MCP tools only — no direct db access from agent code

---

## Agents

| Agent                      | Role                                                                                                                                                                                                                                                                                       | Patterns                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| **TriageAgent**            | Raw incident → structured: threat type, required stats, danger level, hero slots (1–4)                                                                                                                                                                                                     | Structured output (Zod)  |
| **RosterAgent**            | Fetches available heroes via MCP, returns profiles                                                                                                                                                                                                                                         | Tool use                 |
| **DispatcherAgent**        | Orchestrator. Triage + Roster → deterministic scoring (code) → stores hidden recommendation                                                                                                                                                                                                | Planning, routing        |
| **HeroAgent**              | One agent class, instantiated per hero with that hero's system prompt (personality, voice). Receives code-determined outcome + mission context + last 5 own missions → writes first-person report in character. Marcus and Zara produce completely different reports for the same outcome. | Memory (last 5 missions) |
| **ReflectionAgent**        | Evaluates HeroAgent report, rewrites if low quality. Max 2 iterations                                                                                                                                                                                                                      | Reflection loop          |
| **EvalAgent**              | Reveals hidden recommendation, compares to player choice, scores and explains                                                                                                                                                                                                              | Evaluation               |
| **IncidentGeneratorAgent** | Generates new incidents dynamically — title, description, required stats (internal), slot count, interrupt options                                                                                                                                                                         | Structured output        |

**Incident pipeline order:** IncidentGeneratorAgent creates the incident → TriageAgent + RosterAgent run via `Promise.all` → DispatcherAgent forms hidden recommendation → **only then** the incident pin appears on the map. By the time the player sees it, analysis is complete.

---

## MCP Server — SDN Database

All agents interact with state via MCP tools only. No direct db access from agent code.

| Tool                           | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `get_available_heroes`         | availability = `available` AND health ≠ `down`         |
| `get_hero_profile`             | Full profile: stats, personality, bio                  |
| `get_hero_mission_history`     | Last 5 missions (memory context for HeroAgent)         |
| `update_hero_state`            | Updates availability + health + cooldown after mission |
| `save_mission_report`          | Persists completed mission report                      |
| `save_dispatch_recommendation` | Stores DispatcherAgent hidden recommendation           |
| `get_dispatch_recommendation`  | Retrieves hidden recommendation for EvalAgent          |

---

## Gameplay Loop

```
IncidentGeneratorAgent generates incident:
  title, description (flavor only), required stats (internal), slot count,
  interrupt options (if any), mission duration (30 / 60 / 90–120s based on severity)
→ TriageAgent reads description → extracts: required stats, slot count, danger level (all internal)
→ RosterAgent fetches available heroes via MCP
  (TriageAgent + RosterAgent run in parallel)
→ DispatcherAgent scores heroes, stores hidden recommendation via MCP
→ Incident pin appears on the map (full pipeline already done)

New incidents spawn on a fixed timer (~45–60s).
Max ~4 active unresolved incidents on the map at once.
No artificial throttling based on hero availability — if the player burned their roster,
that's the consequence. Incidents pile up, city takes damage, that's the game.

Player clicks incident pin → modal opens
→ sees: description (text only — no stat list, no danger level number)
→ sees: hero slots (1–4 max)
→ selects heroes, clicks DISPATCH
→ heroes status → on_mission for the incident's duration

TYPE 1 — No interrupt:
  Heroes locked for mission duration
  On completion: code calculates outcome via coverage formula
  Mission report generated, eval runs, heroes enter cooldown

TYPE 2 — Interrupt:
  Partway through mission duration → pipeline pauses → interrupt modal shown
  All 2–4 text options visible (no stat icons yet)
  Hero-specific option always rendered — greyed out + unselectable if that hero wasn't sent
  (player sees what they missed — intentional feedback loop)
  If player sent top-1 hero → hero-specific option selectable → guaranteed success
  Player picks option → stat icons revealed on all options after choice
  Outcome calculated from chosen option's stat vs hero's value in that stat

HeroAgent generates combined in-character report matching the outcome (flavor text)
ReflectionAgent polishes report (max 2 iterations, hidden from player)
EvalAgent reveals hidden recommendation, compares to player's choice, scores and explains
SSE streams full pipeline activity to log panel in real time
update_hero_state → cooldowns set → roster bar updates
```

---

## Mission Outcome (deterministic, not LLM)

Coverage is calculated per stat — how much of each requirement the dispatched heroes cover — then averaged into a single score. A quadratic curve converts coverage to success probability, rewarding strong matches and punishing weak ones non-linearly.

```typescript
function getMissionOutcome(
  heroes: Hero[],
  requiredStats: Partial<Record<Stat, number>>,
): "success" | "failure" {
  const combined = combineStats(heroes);
  const statKeys = Object.keys(requiredStats) as Stat[];

  // Per-stat coverage capped at 1.0 — overpowering a stat doesn't help beyond full
  const perStat = statKeys.map((s) =>
    Math.min(combined[s] / requiredStats[s]!, 1.0),
  );
  const coverage = perStat.reduce((a, b) => a + b, 0) / perStat.length;

  // Quadratic curve: coverage 1.0 → 100%, 0.75 → ~56%, 0.5 → 25%, 0.25 → ~6%
  const successChance = Math.pow(coverage, 2);
  return Math.random() < successChance ? "success" : "failure";
}
```

Code decides outcome. LLM receives it and generates narrative to match — never the reverse.

After failed mission: weighted random — hero becomes `injured` or rarely `down`.

Hero slots = maximum, not requirement. One strong hero can solo a 2-slot incident.

---

## Hero Stats

- **Threat** — physical force (1–10)
- **Grit** — durability (1–10)
- **Presence** — charisma (1–10)
- **Edge** — tactical mind / intelligence (1–10)
- **Tempo** — agility / reflexes (1–10)

---

## Hero Status

**Availability:** `available` | `on_mission` | `resting`

**Health:** `healthy` | `injured` (stat penalties, longer cooldown, still dispatchable) | `down` (permanent until handled)

**Cooldowns:** resting ~30s | injured ~90s | down permanent

Incident spawn: ~45–60s. Good decisions = roster available. Bad streak = pressure.

---

## Roster

| #   | Hero           | Alias      | Threat | Grit | Presence | Edge | Tempo |
| --- | -------------- | ---------- | ------ | ---- | -------- | ---- | ----- |
| 1   | Marcus Cole    | Ironwall   | 9      | 10   | 5        | 4    | 2     |
| 2   | Zara Osei      | Static     | 3      | 4    | 6        | 10   | 6     |
| 3   | Danny Kowalski | Boom       | 9      | 7    | 4        | 3    | 5     |
| 4   | Priya Sharma   | Veil       | 2      | 4    | 10       | 8    | 4     |
| 5   | Rex            | Rex        | 10     | 10   | 1        | 3    | 3     |
| 6   | Felix Voss     | Fracture   | 6      | 5    | 7        | 5    | 10    |
| 7   | Mother Agnes   | —          | 1      | 5    | 9        | 7    | 2     |
| 8   | Kai Park       | Null       | 5      | 6    | 4        | 8    | 7     |
| 9   | Diana Vance    | Duchess    | 8      | 6    | 5        | 9    | 6     |
| 10  | Tommy Ruiz     | Static Jr. | 4      | 5    | 6        | 5    | 7     |

### Hero Profiles (for HeroAgent system prompts)

**Marcus "Ironwall" Cole** — Specialist (Threat/Grit). Calm, few words, says things that matter. 20-year Nova City PD vet. Absorbs physical damage. Moral compass of the team. Best: armed situations, protecting civilians, holding the line. Worst: negotiations with influencers, anything requiring running.

**Zara "Static" Osei** — Specialist (Edge). Talks fast, interrupts, explains things nobody asked for. Controls EM fields — jams tech, intercepts signals. 340k TikTok followers. Considers most incidents "technically solvable without physical contact." Best: cyber threats, tech-heavy robberies, anything with electronics. Worst: nature, fistfights.

**Danny "Boom" Kowalski** — Specialist (Threat/Grit). Genuinely kind, enthusiastic like a labrador with explosives. Films every explosion for "personal archive." Former EOD, explosion ability became internal. Insurance company hates him. Best: demolition, terrorist threats, sieges. Worst: negotiations, "please don't touch anything."

**Priya "Veil" Sharma** — Specialist (Presence/Edge). Professional to the point of cold. Media face of the Agency. Secretly runs anonymous podcast on supervillain psychology. Senses and subtly influences emotions within 10m — not mind control, more "remove panic." Best: hostages, public disorder, media crises. Worst: physical force, robots/drones.

**Rex** — Specialist (Threat/Grit, extreme). Unexpectedly gentle, slightly anxious. Worried people fear him. Types "good morning everyone 🌸" daily. Watches cooking shows. 7-meter anthropomorphic lizard in XXXXXL Agency vest. Origin classified. Forgets how large he is at inconvenient moments. Best: large-scale threats, mass riots, monsters. Worst: indoors, anything requiring subtlety, media appearances.

**Felix "Fracture" Voss** — Specialist (Tempo). Functional narcissist — very fast, very good, entirely aware of it. 2.1M followers. Controls local inertia: instant acceleration, direction change, kinetic transfer. Recruited at 19, hasn't matured since. Best: chases, evacuations, anything timed. Worst: sieges, patience, teamwork.

**Mother Agnes** — Specialist (Presence/Edge). Elderly, quiet, never raises her voice — somehow more frightening than yelling. Generates psychological pressure field ("conscience"). Accelerates ally biological recovery. Former schoolteacher. Came to Agency herself. Nobody dared refuse. Best: civilian work, youth incidents, anything requiring voluntary compliance. Worst: physical threats, robots, speed.

**Kai "Null" Park** — All-rounder (Edge/Tempo lean). Talks little, observes much. Can say something precise then be silent for an hour. No social media. Neutralizes superpowers via contact. Agency's secret weapon against enhanced threats. Best: enhanced opponents, neutralization missions. Worst: ordinary crimes (ability irrelevant), mass events, publicity.

**Diana "Duchess" Vance** — All-rounder (Edge/Threat lean). Perfectionist with dry black humor she never announces. Plans everything. Physical pain when plans change mid-mission. Keeps secret efficiency spreadsheet on all colleagues. Former military sniper. Precision perception — sees trajectories, calculates physical outcomes, never misses. Best: precision ops, sniper threats, complex multi-stage situations. Worst: chaotic events, unpredictable situations, working with Rex.

**Tommy "Static Jr." Ruiz** — All-rounder (weak). Genuine enthusiast in a room of cynics. Knew every agent's stats before joining. Tries so hard to help that he sometimes gets in the way. Unstable telekinesis — sometimes perfect, sometimes nothing, once accidentally lifted the Agency van. On probationary period. Felix ignores him. Mother Agnes bakes him separate cookies. Best: supporting experienced agents, low-pressure incidents. Worst: high-threat incidents, anything where unstable ability is dangerous, media.

---

## UI

Comic book aesthetic, dark theme.

```
┌─────────────────────────────────────┬──────────────────┐
│                                     │  SDN LOG         │
│          CITY MAP                   │────────────────  │
│                                     │ Analyzing...     │
│  [Bank Robbery]  [Fire]             │ 6/10 available   │
│  [Alien Landing] [Cat in tree]      │ Agent picked:    │
│                                     │   Ironwall       │
│  incidents clickable                │ Eval: 9/10       │
│  icons vary by danger level         │   good call      │
│                                     │ [scrollable,     │
│                                     │  semitransparent]│
├─────────────────────────────────────┤                  │
│  ROSTER BAR — fixed, always visible │                  │
│  [portrait] [portrait] [portrait] [portrait] ...       │
│  Available  Resting:12s  On mission  Injured:45s       │
└─────────────────────────────────────┴──────────────────┘
```

**Hero states in roster bar:** Available (full color) | On mission (highlighted, locked) | Resting (greyed, countdown) | Injured (greyed + icon, longer countdown) | Down (dark overlay)

**Hero Card Modal:** portrait, name/alias, stat bars (1–10 visual), bio, mission stats, current status.

**Incident Modal:** title + description (text only — no stat list, no danger level), hero slots (1–4), dispatch button. When open: roster shows stat bars so player can reason about who fits.

---

## Game Mode (MVP)

**City Health** — starts at 100. The city takes damage when missions fail or expire unresolved.

- Normal mission failure: -10 HP
- Hero goes down: -20 HP
- Incident expires unresolved (nobody dispatched in time): -15 HP
- Game over at 0. Player sees final stats, can restart.

**Session** — one continuous run until city health hits 0. No auth required for MVP. Session data stored locally / in DB for the run.

**Spawn pressure** — new incident every ~45–60s. Max 4 active on the map. No artificial help — if the player's roster is depleted, incidents pile up. That's a consequence, not a bug.

**Danger level** — internal scale 1–3: 1=minor, 2=standard, 3=major. Never shown as a number to the player (only as visual pin styling on the map).

**Mission duration** (time on scene) set by IncidentGeneratorAgent at creation time:

- Minor (danger 1): ~30s
- Standard (danger 2): ~60s
- Major (danger 3): ~90–120s

**Travel time** — heroes travel to the incident and back to base. Flat ~10–15s each way for now. Heroes are locked `on_mission` for the full trip: travel there + mission duration + travel back. Outcome is calculated when mission duration completes (while still on scene), heroes return after.

**Incident status lifecycle:** `pending` → `en_route` → `active` → `completed` | `expired`

- `pending` — on the map, waiting for player to dispatch
- `en_route` — heroes traveling to the incident
- `active` — heroes on scene, mission running
- `completed` — mission done (success or failure)
- `expired` — expiry timer ran out, nobody dispatched

Future: travel time could scale with map position or Tempo stat.

**Incident expiry timer** — each incident has a countdown before it expires unresolved. Scales with difficulty: harder incidents give more time (bigger events take longer to unfold, player needs time to find the right heroes). Expiry timer visible on the map pin.

- Minor: ~60s to dispatch before expiry
- Standard: ~120s
- Major: ~180s

Ignoring a hard incident is a real choice — it stays on the board longer but the city damage on expiry is higher.

**SSE stream** carries both log panel events and `incident:new` pushes — one persistent connection, multiple event types. No polling needed on the frontend.

---

## MCP Server Architecture

Separate Node.js process, same Docker Compose stack. Agents connect to it via the OpenAI Agents SDK built-in MCP client — they discover and call tools the same way they call regular tools.

```
Agent → OpenAI Agents SDK MCP client → MCP Server → Drizzle → Postgres
```

**Shared DB package via npm workspaces** — schema is defined once and imported by both backend and MCP server. Avoids duplication and keeps schema changes in sync automatically.

```
vigil/
├── packages/
│   └── db/              # @vigil/db — schema, enums, types, db connection
├── backend/             # imports from @vigil/db
├── mcp-server/          # imports from @vigil/db
└── package.json         # workspace root
```

Both services import the same way:
```typescript
import { heroes, incidents } from "@vigil/db"
```

**Build order:**
1. Set up npm workspaces + `packages/db` with shared schema
2. Move current `backend/src/db/` into `packages/db`
3. Update backend to import from `@vigil/db`
4. Build MCP server importing from `@vigil/db`

---

## Future (not MVP, but build toward it)

- **Auth + user accounts** — sessions tied to a user, leaderboards
- **Shift mode** — handle X incidents per shift, get debriefed and scored at the end
- **Hero progression** — skills that reduce mission duration, improve stat effectiveness, unlock after N missions
- **Tempo influencing mission speed** — high Tempo heroes complete missions faster
- **Create your own hero** — custom name, stats, bio, generated portrait
- **Campaign / story mode** — scripted incident sequences with escalating difficulty
- **Hero recruitment** — replace `down` heroes via a recruitment mechanic

Schema should anticipate users, sessions, and hero_skills tables from day one even if unused in MVP.

---

## Deployment

```
Vercel         → Next.js frontend
AWS            → backend (Node.js/TS) + MCP server + RDS (PostgreSQL)
Docker Compose → local dev (Postgres + backend + MCP server)
```

SDK built-in traces = primary observability. Langfuse Cloud = optional.
