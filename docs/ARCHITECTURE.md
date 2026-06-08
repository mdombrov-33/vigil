# Architecture

This is the canonical reference for how **Vigil** works. Open it to re-understand any part of
the system: the game loop, the hidden multi-agent pipelines, the session arc system, mission
resolution, the MCP server, the pause-aware schedulers, the SSE realtime layer, and the
frontend store.

File paths are given throughout so you can jump from a concept to the code.

---

## 1. What it is

Vigil is a **web game with a hidden multi-agent system inside it**. The player is a dispatcher
for the Superhero Dispatch Network (SDN). Incidents spawn on a city map; the player drags
heroes onto an incident and dispatches them. Behind every incident, a chain of LLM agents has
already analyzed the situation, formed its **own** recommendation for who should go, and
written the world around the player's choices — but the player never sees that machinery
directly. They see incidents, hero portraits, a city-health bar, a score, and a comms log.

The "game" the agents are playing is **narrative coherence and judgment**, not reflexes:

1. At shift start, an agent invents **1–2 narrative arcs** that will weave through the session
   (a villain, a crisis chain, a mystery, a personal arc tied to one hero…).
2. Every ~50 seconds the game loop **spawns an incident**. A pipeline of agents writes its
   flavor text, extracts its hidden mechanics (which stats matter, how many heroes, danger,
   timing, whether a mid-mission twist fires), picks the "ideal" team two different ways, and
   stores a hidden recommendation.
3. The player dispatches. Heroes travel, work the scene, and a **mission pipeline** resolves
   the outcome — sometimes interrupted by a mid-mission decision the player must make under a
   ticking (pausable) clock.
4. After the mission, each dispatched hero **writes a first-person report in its own voice**
   (a per-hero agent whose system prompt *is* that hero's personality), a reviewer agent
   polishes it, and an evaluator agent grades the player's dispatch against the hidden
   recommendation.
5. Consequences (score, city health, hero injuries/cooldowns) are applied only **after** the
   player opens the debrief — so nothing spoils the outcome early.

It is a **multi-agent** system because no single model does all of this. Roles are split across
eight distinct agents (§5), orchestrated by two **pipelines** (§7, §8). Agents never call each
other directly — a pipeline calls them in sequence, and the only data an agent fetches
mid-run comes through an **MCP server** (§9). Everything the player sees arrives over a single
**Server-Sent Events** connection (§11); the frontend is a thin, SSE-driven state machine
(§12).

**One LLM provider, two model tiers (`backend/src/agents/models.ts`):**
- **`MODEL_FULL` (`gpt-5.4`)** — agents whose output the player reads or that require real
  judgment: session arcs, narrative hero pick, hero reports, evaluation.
- **`MODEL_FAST` (`gpt-5.4-mini`)** — mechanical/structured agents: incident flavor, triage,
  the dispatcher write-tool call, the reflection reviewer.

All agents use the **OpenAI Agents SDK** (`@openai/agents`), **Zod** schemas for structured
output, and a **shared retry policy** (§5.1). Observability is the SDK's built-in tracing,
exported to OpenAI (`backend/src/tracing.ts`).

---

## 2. The big picture — two clocks and a pipeline per event

Vigil has no single request lifecycle. It has **two server-side clocks** ticking independently
for every active session, plus **player-triggered** HTTP requests. Everything funnels results
to the browser over SSE.

```
                              ┌─────────────────────────────────────────────┐
   ┌── 5s game-loop tick ─────┤ per active session:                          │
   │   (game-loop.ts)         │  • expire overdue pending incidents          │
   │                          │  • maybe spawn → runIncidentCreationPipeline │──┐
   │                          │  • detect session completion                 │  │
   │                          └─────────────────────────────────────────────┘  │
   │                                                                            │
   │   ┌── 5s cooldown tick ──┐  flip resting heroes back to available         │
   │   │ (cooldown-resolver)  │  (skipping heroes in paused sessions)          │
   │   └──────────────────────┘                                                │
   │                                                                           ▼
   │                                                            ┌──────────────────────────┐
 SSE│ (one persistent connection per session)  ◄───── send()───┤  Incident pipeline (§7)   │
   │                                                            │  arc→generate→triage→     │
   ▼                                                            │  narrative-pick→score→    │
 browser ── Zustand store ── React UI                           │  dispatcher(MCP write)    │
   │                                                            └──────────────────────────┘
   │  player drags heroes, clicks dispatch
   ▼
 POST /incidents/:id/dispatch ──► runMissionPipeline (§8) ──► travel→[interrupt?]→outcome→
                                   hero reports→reflection→eval(MCP read)→ send mission:outcome
   │
   ▼
 POST /incidents/:id/roll        (non-interrupt reveal)
 POST /incidents/:id/acknowledge (the commit point — applies score/health/cooldowns)
```

The two background intervals are started once at boot (`backend/src/index.ts`) and run for the
life of the process. Pipelines are **fired-and-forgotten** (`.catch(...)`) so the HTTP response
or the tick returns immediately while the agents work in the background and stream their
results via SSE.

---

## 3. Process startup

`backend/src/index.ts` is the whole boot sequence:

1. `initTracing()` — register the OpenAI Agents SDK batch trace exporter (`tracing.ts`).
2. Express app: CORS (allowlist from `ALLOWED_ORIGINS`), JSON body parsing, `/api/healthz`.
3. Mount routers: `/api/v1/sessions`, `/api/v1/incidents`, `/api/v1/heroes`, `/api/v1/sse`,
   and the MCP server on `/mcp`.
4. On `listen`:
   - **run migrations** (`drizzle-orm` migrator against `./src/db/migrations`),
   - **connect the agent-side MCP client** (`mcpServer.connect()` — see §9),
   - **start the two schedulers**: `startHeroRecovery()` and `startIncidentScheduler()`.

There is no per-request DI container; modules import the shared `db` client
(`backend/src/db/client.ts`) and the singleton SSE connection map directly.

---

## 4. The data model

Schema lives in `backend/src/db/schema.ts`; enums in `backend/src/db/enums.ts`. Drizzle ORM
over PostgreSQL. Migrations are **always** generated (`make generate name=…`), never
hand-written.

| Table | Purpose | Notable columns |
|---|---|---|
| `sessions` | one shift | `cityHealth` (start 100), `score`, `arcSeeds jsonb` (the narrative threads), `sessionMood`, `incidentLimit`/`incidentCount` (finite shift length) |
| `heroes` | the roster (seeded, not per-session) | 5 stats (`threat/grit/presence/edge/tempo`), `availability` enum, `health` enum, `cooldownUntil`, dossier fields (`age/height/labels`), `personality text` (the per-hero agent system prompt), `bio`, portrait URLs, mission counters |
| `incidents` | one spawned situation | `requiredStats jsonb` (hidden), `slotCount` (1–4), `dangerLevel` (1–3), timing, `hints jsonb`, interrupt fields, `topHeroId` (narrative pick), `arcId`, `linkedHeroAlias`, `status` enum, `expiresAt` |
| `missions` | one dispatch against an incident | `outcome`, `roll real` + `dispatchedStats jsonb` (stored for the ROLL reveal, non-interrupt only), eval fields |
| `missionHeroes` | junction (which heroes, which mission) | `report` (the polished in-character report) |
| `dispatchRecommendations` | the **hidden** ideal team | `recommendedHeroIds jsonb`, `reasoning`; `unique(incidentId)` |

**Enums** (`enums.ts`):
- `availability`: `available | on_mission | resting`
- `health`: `healthy | injured | down`
- `incident_status`: `pending → en_route → active → debriefing → completed | expired`
- `mission_outcome`: `success | failure`
- `eval_verdict`: `optimal | good | suboptimal | poor`

**Why some columns aren't where you'd expect:**
- `requiredStats` is on the incident but **hidden from the player** until the post-mission
  reveal — the whole game is inferring it from `hints` and the description.
- `missions.roll`/`dispatchedStats` exist so the outcome can be revealed *on a click*, not on
  the SSE that announces the mission ended (§8, §10).
- The recommendation lives in its own table with a unique constraint on `incidentId` so the
  dispatcher's MCP write is idempotent.

**Layering rule (enforced project-wide):** `route → handler → db/queries`. Routes are thin
wiring; handlers call **named query functions** in `backend/src/db/queries/` and never touch
raw Drizzle. Services, pipelines, and MCP tools all go through `db/queries/` too — it is the
single source of truth for DB access. Pure logic (formulas, cooldown math) stays in
`backend/src/services/{outcome,cooldown}.ts` and has no DB dependency.

---

## 5. The agent roster

Eight agents, defined one-per-file in `backend/src/agents/`. Each is a thin `new Agent({...})`
plus a `run…()` wrapper that builds the prompt and returns typed output.

| Agent | Model | Uses MCP | Role | File |
|---|---|---|---|---|
| **SessionArcAgent** | full | no | Once per shift: invent 1–2 narrative arc seeds + set `incidentLimit` + `sessionMood`. | `session-arc.ts` |
| **IncidentGeneratorAgent** | fast | no | Write incident title + description + which arc it advances. Arc- and pacing-aware. | `incident-generator.ts` |
| **TriageAgent** | fast | no | Extract hidden mechanics: `requiredStats` (1–3 only), `slotCount`, `dangerLevel`, timing, `hints`, interrupt config. | `triage.ts` |
| **NarrativePickAgent** | full | no | Pick the single best hero by *character/power fit* (ignores stats). Sets `topHeroId`. | `narrative-pick.ts` |
| **DispatcherAgent** | fast | **write** | Persist the hidden stat-based recommendation via `save_dispatch_recommendation`. | `dispatcher.ts` |
| **HeroReportAgent** | full | **read** | One instance per dispatched hero. `personality` is its system prompt. Reads its own mission history, writes a ≤3-sentence first-person report. | `hero-report.ts` |
| **ReflectionAgent** | fast | no | Review each hero report against the hero's bio + incident; reject/rewrite for wrong voice, generic content, or outcome mismatch. Max 2 passes. | `reflection.ts` |
| **EvalAgent** | full | **read** | Read the hidden recommendation, compare to the player's actual dispatch, score 0–10 + verdict + a cold in-universe post-op note. | `eval.ts` |

### 5.1 Shared retry policy

`backend/src/agents/models.ts` exports `RETRY`, spread into every agent's `modelSettings`. It
retries transient HTTP and Zod output-parse failures (3 attempts, exponential backoff with
jitter) but **refuses to replay** a request the provider marked replay-unsafe (e.g. one that
may have already performed a tool write) or a caller-aborted one. This is the SDK-native
replacement for an older `async-retry` wrapper.

### 5.2 Two independent "ideal team" rankings

A subtle but central design point: there are **two** notions of the best hero, computed over
all non-`down` heroes (availability is *ignored* — the ideal team is independent of who's
currently deployed):

- **Stat-based** — `scoreHeroes()` in `services/outcome.ts`. Pure math: rank heroes by how well
  their stats cover `requiredStats`, take the top `slotCount`. This feeds the **dispatcher
  recommendation** and the **eval grade**.
- **Narrative-based** — `NarrativePickAgent`. Pure character/power fit, numbers ignored.
  Produces `topHeroId`, which unlocks the **hero-specific interrupt option** (§8.2) and marks
  the report author as "lead".

They answer different questions ("who is statistically sufficient?" vs "who is *the* obvious
answer to this situation?") and are deliberately allowed to disagree.

---

## 6. Session start (the arc system)

`POST /sessions/:id/start` (`api/v1/handlers/sessions.ts → startSession`):

1. Clear stale incidents from any previous play on this session; **reset all heroes** to full
   availability/health and zeroed counters (`resetAllHeroes()`). The roster is global and
   shared, so a new shift resets it.
2. If the session has **no `arcSeeds` yet**, run `SessionArcAgent` over the hero bios and
   persist `arcs`, `sessionMood`, and `incidentLimit`.
3. `registerSession()` (arms the spawn clock), respond `{ started: true }`.

**Critical invariant — idempotent start.** React StrictMode double-invokes effects in dev, so
`start` is called twice. Two guards prevent generating arcs (and burning an LLM call) twice:
the persisted `arcSeeds` check **and** an in-memory `arcGenerating` Set lock around the agent
call.

The arc seeds are the spine of session coherence. `SessionArcAgent` (`session-arc.ts`) is
prompted to produce varied arc *types* — `villain | crisis | diplomatic | mystery | absurd |
personal | faction` — each with a rich `concept`, a `tone`, and a `targetBeats` count (2–4).
For a **personal arc**, it sets `linkedHeroAlias` to a roster hero; that hero becomes the
subject of the thread but must **never** be written as already on-scene (see §7).

---

## 7. The incident creation pipeline

`backend/src/agents/pipelines/incident.ts → runIncidentCreationPipeline(sessionId)`. Triggered
by the game loop's spawn check (§10) or `POST /incidents/generate`. Orchestrates agents in
order — **no agent calls another**.

```
load session + all non-down heroes + this session's incident history
        │
        ▼
computePacingStatus()   ← deterministic, no LLM: decides "advance arc_b" vs "standalone"
        │
        ▼
IncidentGeneratorAgent  → { title, description, arcId }   (arc- and pacing-aware)
        │
        ├─ resolve linkedHeroAlias (only for personal arcs)
        ▼
   ┌─────────────────── run in parallel ───────────────────┐
   │ TriageAgent(description) → mechanics                   │
   │ NarrativePickAgent(description, heroes) → topHeroId    │  (skipped for personal arcs)
   └────────────────────────────────────────────────────────┘
        │
        ▼
scoreHeroes(heroes, requiredStats, slotCount)   → stat-based recommended team
        │
        ▼
createIncident(...)   (expiresAt floored at 180s — see below)
        │
        ▼
DispatcherAgent(incident, recommended, triage)  → MCP write: save_dispatch_recommendation
        │
        ▼
send(sessionId, "incident:new", {...})          → pin drops on the player's map
```

**Pacing is deterministic, not vibes.** `computePacingStatus()` does the session math *before*
the LLM call — how many slots remain, how many beats each arc still needs, the standalone
ratio — and emits a concrete `recommendation` string ("arc beats only from here", "standalone
— no standalones yet", "advance arc_b — needs 3 beats in 9 slots", …). The generator prompt is
told this is **derived from session math, not a suggestion**. This keeps arcs actually
concluding within the finite shift instead of drifting.

**Arc continuity is fed back in.** The generator receives the previous beats of each arc —
their outcomes, eval verdicts, post-op notes, and even the heroes' field reports — so a thread
can build on what literally happened on the ground (and worsen if a prior beat failed).

**Personal arcs skip the narrative pick.** When the incident belongs to a `personal` arc, the
`linkedHeroAlias` is resolved to a hero and that hero is forced as `topHeroId` (with reasoning
`"personal arc — linked hero"`), so `NarrativePickAgent` isn't run. The linked hero is the
*subject* of the situation, never placed on-scene.

**Minimum expiry floor.** The pipeline itself takes 20–40s of model time. A triage-set expiry
shorter than that would expire before the player ever saw the pin, so `expiresAt` is floored at
`MIN_EXPIRY_S = 180`.

**TriageAgent's stat discipline matters mathematically.** It is instructed to include **only
the 1–3 deciding stats** and leave the rest out. This is load-bearing for the outcome formula
(§8.1): padding with irrelevant stats would average away the gaps the formula is meant to
punish.

---

## 8. The mission pipeline

`backend/src/agents/pipelines/mission.ts → runMissionPipeline(incidentId, heroIds)`. Fired
(background) by `POST /incidents/:id/dispatch` after the handler validates slot count and hero
availability, locks the heroes to `on_mission`, sets the incident `en_route`, and emits
`hero:state_update` for each.

```
createMission + createMissionHeroes
        │
        ▼
sleep(12s travel)  →  setIncidentStatus(active)  →  send incident:active
        │
        ▼
 ┌── interrupt incident? ───────────────────────────────────────────────┐
 │ YES (§8.2):                              NO (§8.1):                    │
 │  sleep(missionDuration/2)                 sleep(missionDuration)       │
 │  send mission:interrupt                   getMissionOutcome(...)       │
 │  choiceId = waitForChoice(timeout)        storeMissionRoll(roll,stats) │
 │   • null → failure (timed out)                                        │
 │   • else → getInterruptOutcome(...)                                   │
 │  send mission:interrupt:resolved                                      │
 └───────────────────────────────────────────────────────────────────────┘
        │
        ▼
setIncidentStatus(debriefing) + incrementMissionCounters(heroIds, outcome)
        │
        ▼
per dispatched hero (parallel):  HeroReportAgent → ReflectionAgent → save report
        │
        ▼
completeMission(outcome)
        │
        ▼
EvalAgent (MCP read of hidden recommendation) → storeMissionEval(score, verdict, note)
        │
        ▼
send mission:outcome   (outcome field INCLUDED only for interrupt missions — see §10)
```

**Consequences are NOT applied here.** Mission counters update, but score, city health, and
hero injuries/cooldowns are deliberately deferred to `POST /acknowledge` (§8.3). Heroes stay
`on_mission` in the UI until the player has read the debrief — no spoilers.

### 8.1 Type 1 — no interrupt (quadratic coverage)

`getMissionOutcome()` in `services/outcome.ts`:

```ts
const coverage = avg( statKeys.map(s => min(combined[s] / required[s], 1.0)) );
const successChance = coverage ** 2;     // quadratic — under-coverage is punished hard
const roll = Math.random();
return { outcome: roll < successChance ? "success" : "failure", roll, dispatchedStats };
```

`combined` is the **summed** stats of the dispatched team (`combineStats()`). Each stat's
contribution is capped at 1.0, so you can't overpay one stat to cover a gap in another — and
the square means partial coverage drops success probability steeply. The `roll` and
`dispatchedStats` are **stored on the mission row** and surfaced only when the player clicks the
ROLL pin (§10, §12) — the `mission:outcome` SSE omits the outcome for these missions.

### 8.2 Type 2 — interrupt (deterministic)

Interrupt incidents have a mid-mission decision. Halfway through the mission the pipeline emits
`mission:interrupt` with the options and awaits the player's choice through the **interrupt
gate** (§8.4). Resolution is deterministic (no RNG):

```ts
// getInterruptOutcome()
if (option.isHeroSpecific) return team.includes(topHeroId) ? success : failure;
else                       return combineStats(team)[option.requiredStat] >= option.requiredValue;
```

Exactly one option is `isHeroSpecific` (guaranteed success iff the narrative `topHeroId` was on
the team — no stat check); the rest are stat checks. If the player never chooses in time,
`waitForChoice` resolves `null` → automatic failure. The `combinedValue` (for stat options) is
sent in `mission:interrupt:resolved` to drive the count-up reveal animation. The handler that
accepts the choice (`submitInterruptChoice`) rejects a hero-specific option if the top hero
wasn't dispatched.

> The **eval grade is independent of the interrupt outcome.** They measure different skills:
> the eval judges *dispatch quality* (did you pick a good team?), the interrupt judges your
> *in-the-moment decision*.

### 8.3 The commit point — `POST /incidents/:id/acknowledge`

This is where the deferred consequences land (`handlers/incidents.ts → acknowledgeDebrief`):

- incident → `completed`;
- on **failure**: `dockCityHealth(-10)`; on **success**: `addScore(verdict)` where verdict maps
  to points (`optimal 100 / good 75 / suboptimal 40 / poor 10`, in `services/city-health.ts`);
- each dispatched hero transitions to `resting`: on failure, `rollHealthAfterFailure()` rolls a
  weighted health outcome (healthy→injured→down), and `getCooldownUntil()` sets the rest timer
  (30s resting, 90s injured, `down` = no timer / permanent); emits `hero:state_update`.

(Incident **expiry** is a separate, harsher penalty: the game loop docks **15** city health
when a pending incident is never dispatched — §10.) City health hitting 0 ends the session with
`game:over`.

### 8.4 The interrupt gate (pause-aware)

`services/interrupt-gate.ts` is an in-memory `Map<missionId, resolver>`. `waitForChoice()`
returns a Promise the pipeline awaits; the player's `POST /interrupt` calls `resolveChoice()`.
Its timeout loop ticks every 200ms but **only advances elapsed time when the session is not
paused** (`isSessionPaused`), so opening the interrupt modal (which pauses) freezes the
decision clock.

---

## 9. The MCP server

Vigil mounts a **Model Context Protocol** server inside the same backend process, on `/mcp`
(`backend/src/mcp/router.ts`). It exposes the small slice of data that an agent needs to
**discover mid-run** — anything known at pipeline start is put in the prompt instead. Tools call
query functions directly (`router → tool → db/queries`), with no handler layer.

**Tools** (`backend/src/mcp/tools/`):

| Tool | Used by | What |
|---|---|---|
| `save_dispatch_recommendation` | DispatcherAgent | persist hidden recommended hero IDs + reasoning (idempotent per incident) |
| `get_hero_mission_history` | HeroReportAgent | last 5 missions for a hero **this session** — the report agent's memory |
| `get_dispatch_recommendation` | EvalAgent | read the hidden recommendation to grade against |

**Resources** (`backend/src/mcp/resources/heroes.ts`): `vigil://heroes` (full roster) and the
templated `vigil://heroes/{heroId}` (one profile) — agent-discoverable roster data.

**Two critical MCP invariants:**
- **The `McpServer` is created fresh per HTTP request** in `router.ts` (`createMcpServer()` on
  each POST/GET). Sharing one instance across requests produced *"Already connected to
  transport"* errors. The transport (`StreamableHTTPServerTransport`, stateless —
  `sessionIdGenerator: undefined`) is also per-request and closed on connection close.
- The **agent-side MCP client** (`backend/src/agents/mcp.ts`, `MCPServerStreamableHttp`) is a
  module singleton connected once at boot, pointed at this server's own `/mcp` URL with
  `cacheToolsList: true`. This is the handle the agents are given via `mcpServers: [mcpServer]`.

---

## 10. The game loop & schedulers

Two independent `setInterval(…, 5000)` loops, started at boot.

### Incident scheduler — `services/game-loop.ts`

Per tick, for each **active session** (a session is "active" if it has a live SSE connection —
`getActiveSessions()` reads the connection map), it runs `checkExpiry` + `checkSpawn`, unless
the session is paused or already completed.

- **Expiry:** pending incidents past `expiresAt` are marked `expired`, emit `incident:expired`,
  and dock **15** city health each.
- **Spawn:** spawn cadence is **randomized per tick** (45–60s, a fresh `Math.random()` each
  time — not fixed at startup), capped at `MAX_ACTIVE_INCIDENTS = 4` concurrent incidents.
  `incidentCount` is incremented **atomically before** firing the pipeline so a slow pipeline
  can't cause a double-spawn.
- **Completion:** once `incidentCount >= incidentLimit` and no incidents are still unresolved,
  emit `session:complete`.

Pause state lives here as an in-memory `Set` (`pauseSession`/`resumeSession`/`isSessionPaused`/
`getPausedSessionIds`), shared with the interrupt gate and cooldown resolver.

### Cooldown resolver — `services/cooldown-resolver.ts`

A separate 5s loop that flips `resting` heroes whose `cooldownUntil` has passed back to
`available` and broadcasts `hero:state_update`. It is **session-pause-aware**: if any session is
paused, heroes whose last mission belongs to a paused session are excluded
(`getFrozenHeroIds`) so they don't recover while the player sits in a modal. `down` heroes have
`cooldownUntil = null` and never auto-recover.

### Pause / resume

`POST /sessions/:id/pause` records the wall-clock pause time and flags the session.
`POST /sessions/:id/resume` computes `pausedMs` and **extends the clocks** so nothing expired
"while the player was away":

1. extend `expiresAt` for all pending incidents by `pausedMs` → emit `incident:timer_extended`
   per incident;
2. extend `cooldownUntil` for resting heroes in this session by `pausedMs` (Postgres
   `make_interval`) → emit `hero:state_update` per hero.

The frontend mirrors this with its own freeze logic (§12.3) — the order of operations is
load-bearing on both sides.

---

## 11. The realtime layer (SSE)

`backend/src/sse/manager.ts` holds **one `Response` per session** in a `Map`. The frontend opens
`GET /api/v1/sse?sessionId=…` once (`routes/sse.ts`) and keeps it alive; a 30s keep-alive ping
prevents proxy timeouts. Helpers: `send(sessionId, event, data)` (one session),
`broadcast(event, data)` (all sessions — used for global hero cooldown recovery), and
`log(sessionId, message)` (a `log` event for the comms panel).

The event vocabulary (and exactly how the UI reacts) :

| SSE event | Emitted by | UI effect |
|---|---|---|
| `log` | everywhere | line typewriters into the comms log |
| `incident:new` | incident pipeline | pin drops on the map |
| `incident:active` | mission pipeline (after travel) | pin label EN ROUTE → ON SCENE |
| `incident:expired` | game loop | pin removed; `-15` health logged |
| `incident:timer_extended` | resume handler | update `expiresAt`, **then** `clearPausedAt()` |
| `mission:interrupt` | mission pipeline | pin → ACT NOW; game does **not** auto-pause |
| `mission:interrupt:resolved` | mission pipeline | stat icons slide in; count-up roll |
| `mission:outcome` | mission pipeline | non-interrupt → pin shows ROLL; interrupt → DEBRIEF (outcome field omitted for non-interrupt) |
| `hero:state_update` | dispatch / acknowledge / resolvers | portrait state + cooldown ring |
| `session:update` | city-health service | health bar + score animate |
| `game:over` / `session:complete` | city-health / game loop | end-of-shift overlay |

**The deliberate omission.** For non-interrupt missions, `mission:outcome` carries the eval
score/verdict/note but **not** the success/failure — because the ROLL pin must reveal it on a
click. For interrupt missions the outcome was already shown in the interrupt modal, so it's
included. This split is the single most error-prone contract between backend and frontend; it
shows up again in §12.

---

## 12. The frontend

Next.js App Router (TypeScript). Route structure (`src/app/`): `/` redirects to `/shift`;
`/shift` is the pre-shift landing; `/shift/[sessionId]` is the active game. The session ID lives
in the URL.

Two state systems, by source of truth:
- **Zustand** (`src/stores/gameStore.ts`) — **all SSE-driven game state**.
- **TanStack Query** (`src/hooks/use*.ts`) — server-fetched data: the hero roster (`useHeroes`)
  and session hydration (`useSession`).

Plus: `@dnd-kit/core` for drag-to-dispatch, `framer-motion` + `recharts` for animation/reveals,
`lucide-react` for stat icons.

### 12.1 The store

`gameStore.ts` holds `cityHealth`, `score`, `incidents[]`, `logEntries[]` (append-only, capped
at 200), `heroStates` (`Record<heroId, {availability, health, cooldownUntil}>`),
`interruptState` + `interruptQueue[]`, `missionOutcomes` (`Record<incidentId, …>`, `outcome`
null until the ROLL reveal), `incidentSlots` (incident → stable map slot, assigned on add),
`incidentHeroes` (incident → dispatched hero IDs, for the travel animation), the pause fields,
and the end-of-shift flags.

**Interrupt queue.** `setInterrupt` checks whether an *unresolved* interrupt is already active;
if so it pushes to `interruptQueue` instead of clobbering the current one. `clearInterrupt`
auto-dequeues the next.

### 12.2 SSE → store wiring

`src/hooks/useSSE.ts` opens the `EventSource` and maps each event onto a store mutation (the
table in §11). It is the only place SSE is consumed. Two non-obvious bits live here:

- on `incident:timer_extended` it updates `expiresAt` **then** calls `clearPausedAt()` — order
  matters (§12.3);
- on `mission:outcome` it seeds the `missionOutcomes` entry with `rollRevealed = hasInterrupt`
  (true for interrupt = no roll step; false for non-interrupt = needs the ROLL click), and only
  logs the outcome line immediately for interrupt missions. For non-interrupt, the log line is
  flushed later by `setOutcomeRevealed` (§12.4).

### 12.3 Pause is two fields, and the timer-freeze is two effects

This is the subtlest part of the frontend.

- `uiPaused: boolean` controls *game logic* (fires the backend pause, freezes the interrupt
  gate).
- `pausedAt: number | null` is the wall-clock ms at pause, controlling the *visual* freeze.

They clear at **different times**: resuming sets `uiPaused = false` immediately, but `pausedAt`
stays set until the SSE `incident:timer_extended` has written the new `expiresAt` into the
store — only then does `clearPausedAt()` run. Clearing `pausedAt` before `expiresAt` updates
makes the timer ring visibly snap.

`TimerRing` (and `useCooldownDisplay`) implement the freeze as **two non-overlapping effects**:
1. a **freeze effect** keyed on `[pausedAt]` only — captures the displayed value at the pause
   moment and does *not* re-run when `expiresAt`/`cooldownUntil` change, so SSE updates arriving
   during a modal can't corrupt the frozen display;
2. a **tick effect** keyed on `[expiresAt, pausedAt]` (or `[cooldownUntil, pausedAt]`) that
   returns early while paused and resumes ticking from the latest value when `pausedAt` clears.

Merging them, or adding `expiresAt` to the freeze deps, reintroduces the snap bug.

Note: **HeroTravelers are not pausable.** The backend 12s travel sleep is fire-and-forget, so
the HQ→pin portrait animations run independently of `uiPaused`.

### 12.4 The outcome reveal flow

`useGameModals.ts` orchestrates which modal is open and pauses/resumes around each. Opening any
modal pauses the game; closing resumes. Dispatch flow: `IncidentModal` → `POST /dispatch` →
optimistic `en_route` + record dispatched heroes (for travelers) → resume.

For the **debriefing** pin, the click target depends on `rollRevealed`:
- non-interrupt + not yet revealed → open `RollRevealModal`;
- otherwise → open `DebriefModal`.

`RollRevealModal` (`src/components/modals/RollRevealModal.tsx`) fetches `POST /roll`, calls
`setOutcomeRevealed()` (which writes outcome/roll/stats into the store **and flushes the log
line** that was withheld), then animates: a **Recharts radar** of required vs dispatched stats,
a success/failure probability bar with a `framer-motion` cursor sweeping to the stored `roll`
position, and confetti on success. The pin then flips to DEBRIEF.

`DebriefModal` close fires `POST /acknowledge` (the commit point, §8.3) and removes the pin.

### 12.5 Modal conventions

**No two-step confirms** — one click = done. Interrupt options submit on click. The debrief has
no Acknowledge button; dismissing it (backdrop or ✕) *is* the acknowledge. Both backdrop and ✕
always dismiss.

### 12.6 Styling

Tailwind v4 with **no config file** — `globals.css` uses `@theme inline { … }` to generate
utilities from `--color-*`/`--font-*` tokens. Aliased tokens use the short utility
(`text-muted-text`); only non-aliased tokens use the arbitrary `[var(--x)]` form. Inline
`style` is reserved for gradients, per-instance CSS vars, ternary-driven values, and
`mixBlendMode`/`oklch()`/`backdropFilter`. Stat tokens (keys, labels, colors, icons) have a
single source of truth in `src/config/statMeta.ts`; map pin slots in `src/config/cityLocations.ts`.

---

## 13. The heroes

Heroes are **seeded**, not generated (`backend/src/db/seed/`). The active roster is the **v2**
set (`seed/heroes/v2/`, wired in `seed/heroes.ts`); v1 is archived. Each hero file is a
`NewHero` with five stats, dossier fields (`age`, `height`, `labels`), a short player-facing
`bio`, and a long `personality` block. Portrait URLs are derived from the alias against
`PORTRAITS_BASE_URL` (a public GCS bucket in prod), with healthy/injured variants.

The `personality` field is special: it is **used verbatim as the system prompt for that hero's
report agent** (`createHeroReportAgent(hero)` in `hero-report.ts`). That's why these blocks are
written in second person, in-voice, with quirks and tics — they are character instructions, not
flavor. The agent reads the hero's own mission history via MCP and writes a ≤3-sentence report;
`ReflectionAgent` then enforces voice/specificity/outcome-match in up to two passes. Seed with
`make seed`.

---

## 14. API reference

All under `/api/v1`. Routers in `backend/src/api/v1/routes/`, handlers in `.../handlers/`.

| Method + path | Purpose |
|---|---|
| `POST /sessions` | create a session |
| `GET /sessions/:id` | hydrate city health + score |
| `POST /sessions/:id/start` | reset heroes, generate arcs (idempotent), arm the spawn clock |
| `POST /sessions/:id/pause` / `…/resume` | freeze / extend-and-thaw the session clocks |
| `GET /incidents?sessionId=` | list active incidents (for reconnect/hydration) |
| `GET /incidents/:id` | one incident (interrupt options only while `active`) |
| `POST /incidents/generate` | manually trigger the incident pipeline |
| `POST /incidents/:id/dispatch` | `{heroIds}` → validate, lock heroes, fire mission pipeline |
| `POST /incidents/:id/interrupt` | `{choiceId}` → resolve the interrupt gate |
| `POST /incidents/:id/roll` | reveal stored `outcome`/`roll`/stats (non-interrupt only) |
| `GET  /incidents/:id/debrief` | hero reports + eval for the debrief modal |
| `POST /incidents/:id/acknowledge` | **commit point** — apply score/health/cooldowns |
| `GET /heroes` | the roster |
| `GET /sse?sessionId=` | the persistent SSE stream |
| `POST|GET|DELETE /mcp` | the MCP server (agent-internal) |
| `GET /api/healthz` | liveness |

---

## 15. Observability

Tracing is the OpenAI Agents SDK's built-in tracing, registered at boot
(`backend/src/tracing.ts`: `BatchTraceProcessor` + `OpenAITracingExporter`). Every `run(agent,
…)` and every MCP tool call is captured as a span and exported to OpenAI's trace viewer — no
custom telemetry layer. Beyond that, the pipelines and services log liberally with bracketed
prefixes (`[incident-pipeline]`, `[mission-pipeline]`, `[game-loop]`, `[sse]`, …) for
local/Cloud Run log inspection.

---

## 16. Project layout

```
backend/src/
  index.ts                  Express app + boot (migrate, MCP connect, start schedulers)
  tracing.ts                OpenAI Agents SDK trace exporter
  agents/
    models.ts               MODEL_FULL / MODEL_FAST / shared RETRY policy
    session-arc.ts          SessionArcAgent      (full)
    incident-generator.ts   IncidentGeneratorAgent (fast) + pacing/context types
    triage.ts               TriageAgent          (fast)
    narrative-pick.ts       NarrativePickAgent   (full)
    dispatcher.ts           DispatcherAgent      (fast, MCP write)
    hero-report.ts          HeroReportAgent      (full, MCP read, per-hero instance)
    reflection.ts           ReflectionAgent      (fast)
    eval.ts                 EvalAgent            (full, MCP read)
    schemas.ts              all Zod output schemas
    mcp.ts                  agent-side MCP client singleton
    pipelines/
      incident.ts           incident creation pipeline + computePacingStatus()
      mission.ts            dispatch → travel → outcome → reports → eval
  api/v1/
    routes/                 thin routers (sessions, incidents, heroes, sse)
    handlers/               sessions.ts, incidents.ts, heroes.ts
  services/
    outcome.ts              scoreHeroes + getMissionOutcome + interrupt math (pure)
    cooldown.ts             cooldown durations + post-failure health roll (pure)
    city-health.ts          score/health mutation + game-over/session-update SSE
    game-loop.ts            5s spawn/expiry/completion loop + pause state
    cooldown-resolver.ts    5s hero-recovery loop (pause-aware)
    interrupt-gate.ts       in-memory pausable wait-for-choice
    *.test.ts               unit tests for outcome / cooldown / interrupt
  db/
    schema.ts, enums.ts, client.ts, index.ts
    queries/                the ONLY place raw Drizzle runs
    migrations/             generated, never hand-written
    seed/heroes/v2/         active roster (v1 archived)
  mcp/
    router.ts               per-request McpServer + transport on /mcp
    tools/                  save/get_dispatch_recommendation, get_hero_mission_history
    resources/heroes.ts     vigil://heroes[/{id}]
  sse/manager.ts            one Response per session + send/broadcast/log

frontend/src/
  app/                      App Router: /, /shift, /shift/[sessionId]
  stores/gameStore.ts       Zustand — all SSE-driven state
  hooks/useSSE.ts           the only SSE consumer; maps events → store
  hooks/useGameModals.ts    modal orchestration + pause/resume
  hooks/{useHeroes,useSession}.ts   TanStack Query server data
  components/game/          map, pins, roster, header, travelers, end screen
  components/modals/        Incident, Interrupt, RollReveal, Debrief, HeroDetail
  config/cityLocations.ts   map pin slots
  config/statMeta.ts        stat keys/labels/colors/icons — single source of truth
```

---

## 17. Branching & deployment

**Branch strategy.** `main` is the pure agent/game system — backend, pipelines, game loop. `dev`
is the full product (landing, auth, tiers, shift roster picker) and is ahead of `main` by that
product layer. Agent improvements land on `main`, then `dev` pulls via `git merge main`; product
work never touches `main`.

**Local dev.** Docker Compose (`docker-compose.yml`): Postgres 18 + the backend in `tsx watch`
mode with `./backend/src` mounted for hot reload. The `Makefile` wraps it (`make up`, `make
generate name=…`, `make seed`, `make studio`). The frontend runs separately (Next dev / Vercel).

**Backend image.** Multi-stage `backend/Dockerfile` — a `dev` target (`tsx watch`) and a `prod`
target that copies `src` and runs `tsx src/index.ts`. Migrations run on process start, so a
deploy self-migrates.

**Cloud.** GCP via Terraform (`terraform/main.tf`):
- **Cloud Run** runs the backend (1 vCPU / 1Gi, `minScale 0 / maxScale 1`), public invoker;
- **Cloud SQL** Postgres 16 (`db-f1-micro`) holds the data, reached over a `DB_URL` env var;
- a public **GCS bucket** serves hero portraits (CORS-enabled), matching `PORTRAITS_BASE_URL`;
- an **Artifact Registry** repo holds the images.

**CI/CD** (`.github/workflows/deploy.yml`): on PRs and pushes touching `backend/**`, run
typecheck + tests. On push to `main`, the deploy job (gated on the green check) authenticates to
GCP via Workload Identity Federation, builds/pushes the `prod` image to Artifact Registry, and
`gcloud run deploy`s it. The frontend deploys on Vercel.

> **Scaling caveat.** Pause state, the interrupt gate, the spawn clock, and the SSE connection
> map are all **in-process memory**, and the SSE model is one persistent connection per session.
> That is correct at `maxScale 1` (the current config) but would break across instances — a
> player's SSE stream, the loop that feeds it, and the pause flag must live on the same process.
> Horizontal scale would require moving session/SSE state to a shared backend (e.g. Redis
> pub/sub) and the in-memory gates with it.
