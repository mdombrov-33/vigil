# Vigil — Incident Dispatcher

> Last updated: 2026-04-08 (db query layer, pipeline split, MCP cleanup)

Web game where the player dispatches superheroes to incidents on a city map. A hidden multi-agent system analyzes each incident and forms its own recommendation — revealed only after the player dispatches.

---

## Stack

| Layer         | Tech                                                    |
| ------------- | ------------------------------------------------------- |
| Backend       | Node.js + TypeScript (Express)                          |
| Frontend      | Next.js (TypeScript)                                    |
| Agents        | OpenAI Agents SDK (`@openai/agents`)                    |
| Models        | `gpt-5.4` (player-facing) / `gpt-5.4-mini` (mechanical) |
| Schema        | Zod structured output                                   |
| ORM           | Drizzle ORM                                             |
| Database      | PostgreSQL                                              |
| MCP Server    | Mounted on `/mcp` inside the backend process            |
| Realtime      | SSE — one persistent connection per session             |
| Observability | OpenAI Agents SDK built-in traces                       |
| Deploy        | GCP (Cloud Run + Cloud SQL), Vercel (frontend)          |
| Local dev     | Docker Compose                                          |
| CORS          | `ALLOWED_ORIGINS` env var on backend (comma-separated list of allowed frontend URLs) |

---

## Repo Structure

```
vigil/
├── backend/
│   └── src/
│       ├── agents/                # One file per agent + mcp.ts + models.ts + schemas.ts
│       │   └── pipelines/         # Pipeline orchestrators (not agents themselves)
│       │       ├── incident.ts    # runIncidentCreationPipeline
│       │       └── mission.ts     # runMissionPipeline
│       ├── api/v1/
│       │   ├── routes/            # Thin Express routers only
│       │   └── handlers/          # Business logic called by routes
│       ├── db/                    # Schema, enums, client, migrations, seed, query layer
│       │   ├── schema.ts
│       │   ├── enums.ts
│       │   ├── client.ts
│       │   ├── index.ts
│       │   ├── queries/           # Named query functions — single source of truth for all DB access
│       │   │   ├── heroes.ts
│       │   │   ├── sessions.ts
│       │   │   ├── incidents.ts
│       │   │   ├── missions.ts
│       │   │   └── recommendations.ts
│       │   ├── migrations/
│       │   └── seed/
│       │       ├── heroes/        # One file per hero (alias as filename)
│       │       ├── heroes.ts
│       │       └── index.ts
│       ├── mcp/                   # MCP server mounted at /mcp — McpServer created per-request
│       │   ├── router.ts          # Express router wiring
│       │   └── tools/             # One file per MCP tool (3 active tools)
│       ├── services/              # Pure logic — outcome, cooldowns, scoring, city health, schedulers
│       ├── sse/                   # SSE manager (connection registry + send/broadcast)
│       ├── tracing.ts
│       └── types/
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx           # Server redirect → /shift
│       │   ├── layout.tsx
│       │   ├── providers.tsx
│       │   └── shift/
│       │       ├── page.tsx       # Pre-shift: map + start screen, no session yet
│       │       └── [sessionId]/
│       │           └── page.tsx   # Active game — session ID in URL
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       ├── types/
│       └── lib/
└── docker-compose.yml
```

**Layering rules:**

- `route → handler → db/queries` — routes are thin wiring only; handlers call named query functions, never raw Drizzle
- `db/queries/` is the single source of truth for all DB access — used by handlers, services, and pipelines alike
- Services (`city-health.ts`, `game-loop.ts`, `cooldown-resolver.ts`) call `db/queries/` for DB operations; pure logic stays in `outcome.ts`, `cooldown.ts`, `interrupt-gate.ts`
- Pipelines (`agents/pipelines/`) orchestrate agents — no agent calls another agent directly
- MCP: `router → tool → db/queries` — tools call query functions directly, no intermediate handler layer

---

## Routing

| Route | Purpose |
|---|---|
| `/` | Server redirect to `/shift` |
| `/shift` | Pre-shift landing — map visible, start screen overlay, no session yet. Pressing "Start Shift" creates a session and navigates to `/shift/:id` |
| `/shift/:sessionId` | Active game — session ID in URL. On mount: boots backend game loop, connects SSE, resets store. End shift → back to `/shift` |

Session ID is internal plumbing — never shown to the user, just lives in the URL for bookmarking/resuming.

---

## Agents

| Agent                      | Model | MCP | Role                                                                                                                          |
| -------------------------- | ----- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| **SessionArcAgent**        | full  | no  | Generates 1–2 narrative arc seeds + incident limit for a new session. Runs once at session start.                             |
| **IncidentGeneratorAgent** | fast  | no  | Generates incident title + description + arcId. Receives full session history + arc beat context (hero reports, eval) for narrative continuity.  |
| **TriageAgent**            | fast  | no  | Extracts required stats (1–3 only), slot count, danger level, timing, interrupt options, hints[], interruptTrigger.           |
| **NarrativePickAgent**     | full  | no  | Picks `topHeroId` based on hero bio/powers/character fit — not stats. Receives full non-down roster (not just available) — narrative fit is independent of availability. Used for interrupt hero-specific option. |
| **DispatcherAgent**        | fast  | yes | Stores hidden stat-based recommendation via `save_dispatch_recommendation`.                                                   |
| **HeroReportAgent**        | full  | yes | One instance per hero, personality as system prompt. Calls `get_hero_mission_history`, writes 3-sentence first-person report. Receives MissionContext (teammates, isLead, interrupt). |
| **ReflectionAgent**        | fast  | no  | Reviews hero report against hero bio + incident description — rejects only for wrong voice, generic content, or outcome mismatch. Max 2 iterations. |
| **EvalAgent**              | full  | yes | Calls `get_dispatch_recommendation`, compares to player dispatch, scores 0–10, outputs verdict + postOpNote.                  |

**Two separate hero rankings, both using all non-down heroes:**

- **Stat-based** (`scoreHeroes`) → dispatcher recommendation, eval grading
- **Narrative-based** (`NarrativePickAgent`) → `topHeroId` on incident, unlocks hero-specific interrupt option

### SessionArcAgent

Runs once per session start (in `handlers/sessions.ts`). Receives the full hero roster (alias + bio) so personal arcs can reference specific heroes by name. Guarded against double-call — skips re-generation if `arcSeeds` already exists on the session (React StrictMode fires effects twice in dev).

Output: `{ arcs: ArcSeed[], incidentLimit: number, sessionMood: string }`

- `sessionMood` — stored on sessions as `session_mood text`, passed to `IncidentGeneratorAgent` via `SessionContext` as overall tone context
- Each `ArcSeed`: `{ id, name, concept, tone, targetBeats, arcType, linkedHeroAlias }` — `tone` is a freeform string (e.g. `"darkly comic"`, `"tense"`, `"bureaucratic nightmare"`), not an enum
- `arcType` enum: `"villain" | "crisis" | "diplomatic" | "mystery" | "absurd" | "personal" | "faction"`
- `linkedHeroAlias` — only set for `arcType === "personal"`, names the specific hero the arc centres on. Null for all other arc types.

**Personal arc behavior:** when `arcType === "personal"`, `linkedHeroAlias` is resolved to a `topHeroId` and NarrativePickAgent is **skipped** — the linked hero always gets `topHeroId` for every incident in that arc. The agent prompt explicitly forbids placing that hero on-scene in generated incidents (they are the subject of the arc, not a responder). `linkedHeroAlias` is stored on each incident and included in the `incident:new` SSE payload so the frontend can highlight the linked hero in the roster when that incident's modal is open.

### IncidentGeneratorAgent

Receives `SessionContext`: `{ arcSeeds, sessionMood, recentIncidents, arcBeats, incidentNumber, incidentLimit, pacingStatus }`.

- `recentIncidents` — full session history (all incidents), lightweight: `{ title, outcome, arcId }`. Used for variety/repetition avoidance and visible balance (arc vs standalone).
- `arcBeats` — rich history grouped by arcId: previous beats for each arc including hero field reports, eval verdict, SDN post-op note. Used for narrative continuity within arc threads.
- `pacingStatus` — pre-computed by `computePacingStatus()` in the pipeline. Contains beats completed/needed per arc, slots remaining, standalone count, and a `recommendation` string (e.g. `"advance arc_b — needs 3 beats in 9 slots"` or `"standalone — no standalones yet"`). The model is instructed to follow the recommendation — it is derived from session math, not a suggestion.
- Generator outputs `arcId` alongside title/description — declaring which arc it's advancing, or null if standalone. Stored on the incident.

**Pacing logic (`computePacingStatus`):** runs in the incident pipeline before calling the generator. Computes `slotsRemaining = incidentLimit - incidentNumber`, `beatsNeeded` per arc, `availableForStandalones = slotsRemaining - totalBeatsNeeded`. Produces a deterministic `recommendation` string: forces standalone on incident 1; flags critical arcs (at risk of not concluding); nudges standalone when ratio is low; otherwise defers to narrative feel.

Builds a contextual prompt with arc seeds, arc beat history, recent incident list (with arc labels), pacing status block, and session mood. Generates incidents in one of 8 rotating format patterns:

- `DISPATCH LOG` — terse official call
- `CALLER TRANSCRIPT` — panicked civilian call fragments
- `INTERCEPTED COMMS` — enemy radio chatter
- `FIELD UNIT REPORT` — officer on scene
- `BREAKING NEWS FRAGMENT` — broadcast cut
- `ANONYMOUS TIP` — cryptic informant message
- `INTERNAL MEMO` — bureaucratic/political flavor
- `HQ SATELLITE NOTE` — drone/overhead observation

**Critical:** the format name is never included as a prefix in the output — it's a production style only.

### TriageAgent

Generates:
- `requiredStats` — 1–3 stat keys only (no padding)
- `slotCount` — 1–3; 1-slot missions are valid for sniper roles, data extractions, volatile negotiations
- `hints[]` — 1–3 field intel bullets with tiered ambiguity (opaque / semi-transparent / near-transparent)
- `interruptTrigger` — one sentence in dispatch voice, past tense, specific situation that caused the interrupt

### HeroReportAgent

Receives `MissionContext`: `{ teammates: string[], isLead: boolean, interrupt?: { chosenOptionText, outcome } }`

- `isLead` — true if this hero is `topHeroId` (the narrative pick). Lead hero's report gets "You led the operation." added to the team line.
- `teammates` — other hero aliases on the mission. Heroes can reference each other.
- `interrupt` — if the mission had an interrupt, the chosen option text and outcome are included so heroes can mention it in their report.

---

## Pipelines

### Incident Creation Pipeline (`runIncidentCreationPipeline`)

```
1. Fetch session + allNonDownHeroes   [parallel]
     allNonDownHeroes → scoreHeroes / DispatcherAgent / NarrativePickAgent / linkedHero lookup
     (down heroes excluded; availability not considered — the "ideal" team is independent of current deployment)
2. Fetch full incident history — all incidents with mission outcomes + eval data
3. Fetch hero reports for arc incidents only (grouped by arcId)
4. IncidentGeneratorAgent(SessionContext)    — builds arc-aware prompt with beat history
5. TriageAgent + NarrativePickAgent          [parallel]
6. scoreHeroes(allNonDownHeroes) — deterministic stat ranking  [pure code]
7. INSERT incident (with hints, interruptTrigger, arcId) → db/queries/incidents
8. Increment session.incidentCount atomically
9. DispatcherAgent → save_dispatch_recommendation (MCP)
10. SSE: incident:new (with hints[]) → pin appears on map
```

### Mission Pipeline (`runMissionPipeline`)

```
1. Fetch incident + heroes from DB
2. INSERT mission + missionHeroes
3. SSE: log "en route"
4. sleep(12s) — travel time
5. UPDATE incident status → active
6. SSE: incident:active (pin label updates to ON SCENE)
7. SSE: log "on scene"

TYPE 1 — No interrupt:
  8a. sleep(missionDuration)
  8b. getMissionOutcome() — quadratic coverage formula
  8c. UPDATE missions SET roll, dispatched_stats   ← stored for /roll endpoint

TYPE 2 — Interrupt:
  8a. sleep(missionDuration / 2)
  8b. SSE: mission:interrupt — options with text + trigger sentence (no stat info)
  8c. waitForChoice(missionId, sessionId, remainingMs) — pause-aware polling loop
  8d. If timeout → auto-fail
  8e. getInterruptOutcome() — stat check or hero-specific check
  8f. SSE: mission:interrupt:resolved — full options with requiredStat/requiredValue, outcome, combinedValue

9.  UPDATE incident → debriefing, heroes → missionsCompleted/Failed counters
10. HeroReportAgent × N (with MissionContext)         [parallel]
11. ReflectionAgent × N (with hero bio + incident description)  [parallel]
12. UPDATE missionHeroes.report per hero
13. UPDATE missions.outcome + completedAt
14. EvalAgent → score/verdict/explanation/postOpNote
15. UPDATE missions eval columns
16. SSE: mission:outcome
    — interrupt missions: includes outcome (already shown in interrupt modal)
    — non-interrupt missions: outcome OMITTED — revealed when player clicks ROLL pin
    — NO hero:state_update, NO score/health changes fire here
```

**Critical ordering:** score/health and hero resting are intentionally deferred to `POST /acknowledge`.
This ensures the ROLL pin appears before any consequences telegraph the outcome, and heroes
remain `on_mission` until the player has fully read the debrief.

---

## SSE Events

One persistent connection per session: `GET /api/v1/sse?sessionId=xxx`

| Event                        | When                              | Payload                                                                                                          |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `log`                        | Throughout pipeline               | `{ message }`                                                                                                    |
| `incident:new`               | Incident pipeline complete        | `{ incidentId, title, description, hints, slotCount, dangerLevel, hasInterrupt, createdAt, expiresAt }`          |
| `incident:active`            | After travel sleep                | `{ incidentId }`                                                                                                 |
| `incident:expired`           | Expiry timer fires                | `{ incidentId }`                                                                                                 |
| `incident:timer_extended`    | Session resume (per pending inc.) | `{ incidentId, expiresAt }` — new wall-clock expiry after backend extends timer                                  |
| `mission:interrupt`          | Halfway through missionDuration   | `{ incidentId, missionId, topHeroId, heroIds, trigger, interruptDurationMs, options }` (text only, no stats)     |
| `mission:interrupt:resolved` | After player choice               | `{ incidentId, missionId, chosenOptionId, outcome, combinedValue, options }` (full options with stat info)       |
| `mission:outcome`            | Mission pipeline complete         | `{ incidentId, missionId, title, heroes, evalScore, evalVerdict, evalPostOpNote, hasInterrupt, outcome? }` — `outcome` only present for interrupt missions |
| `hero:state_update`          | After hero state changes          | `{ heroId, alias, availability, health, cooldownUntil }`                                                         |
| `session:update`             | After city health or score change | `{ cityHealth, score }`                                                                                          |
| `game:over`                  | cityHealth reaches 0              | `{ finalScore }`                                                                                                 |
| `session:complete`           | All incidents resolved at limit   | `{ finalScore }`                                                                                                 |

**SSE manager** (`backend/src/sse/manager.ts`): `send(sessionId, event, data)` for session-scoped events, `broadcast(event, data)` for global (cooldown resolver uses broadcast since heroes are global).

---

## Game Loop (`services/game-loop.ts`)

Runs every 5s per active SSE session. Skips entirely if session is paused.

- **Expiry check** — finds `pending` incidents where `expiresAt < now`, marks `expired`, docks -15 city health, emits `incident:expired`
- **Spawn check** — checks `session.incidentCount` vs `session.incidentLimit`. If limit not reached: spawns a new incident every 45–60s (randomized per-tick) if active incidents < 4. Increments `incidentCount` atomically before spawning.
- **Completion check** — when `incidentCount >= incidentLimit` and no active incidents remain: calls `completeSession()` → emits `session:complete`, marks `endedAt`, stops the loop for that session.

Exports: `pauseSession(id)`, `resumeSession(id)`, `isSessionPaused(id)` — used by pause/resume API endpoints and the interrupt gate.

Spawn interval is randomized **per tick** (45–60s, fresh `Math.random()` each check) — not once at startup. The module-level `SPAWN_INTERVAL_MS` constant is only used for the initial `lastSpawn` offset so the first incident spawns ~10s after session start.

**On resume:** backend calculates `pausedMs = now - pausedAt`, then:
1. Extends `expiresAt` for all pending incidents by `pausedMs` (via `make_interval`) → emits `incident:timer_extended` per incident
2. Extends `cooldownUntil` for all resting heroes in this session by `pausedMs` → emits `hero:state_update` per hero

**`POST /sessions/:id/start` idempotency:** checks if `arcSeeds` already exists before running `SessionArcAgent` — prevents double LLM call from React StrictMode double-invoking effects in dev.

**Cooldown resolver** (`services/cooldown-resolver.ts`) — separate 5s interval, finds `resting` heroes where `cooldownUntil <= now` AND `cooldownUntil IS NOT NULL` (excludes `down` heroes), flips to `available`, broadcasts `hero:state_update`. **Session-aware:** if any sessions are paused, heroes whose last mission belongs to a paused session are skipped — they will not recover until the session resumes. This prevents heroes from becoming available while a player is sitting in a modal.

---

## Interrupt Gate (`services/interrupt-gate.ts`)

`waitForChoice(missionId, sessionId, timeoutMs)` — pause-aware. Instead of a plain `setTimeout`, polls every 200ms and only increments elapsed time when `isSessionPaused(sessionId)` is false. This means the interrupt timer freezes while the player has any modal open.

---

## Mission Outcome

**Type 1 (no interrupt):** quadratic coverage formula

```typescript
// Per-stat coverage capped at 1.0, averaged, then squared
const coverage = avg(statKeys.map(s => min(combined[s] / required[s], 1.0)));
const successChance = coverage²;
const roll = Math.random();
return { outcome: roll < successChance ? "success" : "failure", roll, dispatchedStats: combined };
```

Triage sets only 1–3 relevant stats. All-stat padding wrecks the formula by averaging away gaps.

`getMissionOutcome` returns `{ outcome, roll, dispatchedStats }`. For non-interrupt missions the pipeline stores `roll` and `dispatched_stats` in the `missions` DB row (new columns). These are **not** sent in the SSE — they're fetched by the frontend when the player clicks the ROLL pin via `POST /incidents/:id/roll`.

**Type 2 (interrupt):**

- `isHeroSpecific: true` → success if `topHeroId` was in dispatched heroes, else failure
- Stat check → `combinedStat >= requiredValue` → success/failure (deterministic, no randomness)
- `combinedValue` (the actual combined stat) sent in `mission:interrupt:resolved` for the roll animation

**Eval** judges dispatch quality independently of interrupt outcome — they test different skills.

---

## City Health & Score

**City health** (starts 100, game over at 0):

- Mission failure: -10
- Incident expires unresolved: -15

**Score** — incremented only on mission success, scaled by eval verdict:

- `optimal` → +100
- `good` → +75
- `suboptimal` → +40
- `poor` → +10

Both emit `session:update` SSE with current `{ cityHealth, score }`.

**Shift end grade** (shown on `ShiftEndScreen`):

| Grade | Label        | Score threshold |
|-------|--------------|-----------------|
| S     | EXEMPLARY    | ≥ 600           |
| A     | OUTSTANDING  | ≥ 400           |
| B     | COMPETENT    | ≥ 250           |
| C     | ADEQUATE     | ≥ 100           |
| D     | NEEDS REVIEW | < 100           |

---

## Database Schema (key additions)

**Sessions table:**
- `arcSeeds jsonb` — array of ArcSeed objects from SessionArcAgent
- `sessionMood text` — one-sentence flavor note from SessionArcAgent, passed to incident generator
- `incidentLimit integer` — total incidents to spawn this session (set by SessionArcAgent)
- `incidentCount integer not null default 0` — how many have been spawned so far

**Incidents table:**
- `hints jsonb` — array of 1–3 field intel strings from TriageAgent
- `interruptTrigger varchar(500)` — one-sentence dispatch-voice context for interrupt modal
- `arcId varchar(10)` — which arc this incident advances (`arc_a`, `arc_b`) or null if standalone
- `linkedHeroAlias varchar(100)` — set only for personal arc incidents; names the hero the arc is about

**Missions table:**
- `roll real` — random roll value [0,1] stored at mission end; only set for non-interrupt missions
- `dispatched_stats jsonb` — combined hero stats at dispatch time; only for non-interrupt missions

**Migrations:** always use `make generate name=<migration_name>` — never hand-write SQL migration files.

---

## MCP Server

Mounted on `/mcp` inside the backend process (`src/mcp/router.ts`). **Critical:** `McpServer` instance is created fresh per request (not shared) — sharing caused "Already connected to transport" errors.

```
Agent (backend) → MCPServerStreamableHttp → localhost:{PORT}/mcp → db/queries → Postgres
```

MCP tools are only for data an agent needs to **discover dynamically mid-run**. Data known at pipeline start is injected into the prompt directly. Tools call `db/queries/` functions — there is no intermediate handler layer.

| Tool                           | Query file                      | Used by           |
| ------------------------------ | ------------------------------- | ----------------- |
| `get_hero_mission_history`     | `db/queries/heroes.ts`          | HeroReportAgent   |
| `save_dispatch_recommendation` | `db/queries/recommendations.ts` | DispatcherAgent   |
| `get_dispatch_recommendation`  | `db/queries/recommendations.ts` | EvalAgent         |

---

## API Routes

| Method | Path                                | Description                                                       |
| ------ | ----------------------------------- | ----------------------------------------------------------------- |
| POST   | `/api/v1/sessions`                  | Create session                                                    |
| GET    | `/api/v1/sessions/:id`              | Get session state (cityHealth, score)                             |
| POST   | `/api/v1/sessions/:id/start`        | Run SessionArcAgent, store arc seeds + limit, start game loop     |
| POST   | `/api/v1/sessions/:id/pause`        | Pause game loop + interrupt timer for this session                |
| POST   | `/api/v1/sessions/:id/resume`       | Resume game loop + interrupt timer; extends pending incident timers |
| GET    | `/api/v1/incidents?sessionId=`      | Active incidents for map (pending/en_route/active/debriefing)     |
| GET    | `/api/v1/incidents/:id`             | Single incident detail                                            |
| POST   | `/api/v1/incidents/generate`        | Manually trigger incident creation pipeline                       |
| POST   | `/api/v1/incidents/:id/dispatch`    | Dispatch heroes — locks immediately, pipeline fires in background |
| POST   | `/api/v1/incidents/:id/interrupt`   | Submit interrupt choice                                           |
| GET    | `/api/v1/incidents/:id/debrief`     | Hero reports for debrief modal                                    |
| POST   | `/api/v1/incidents/:id/roll`        | Fetch stored outcome data (roll, stats) — no side effects         |
| POST   | `/api/v1/incidents/:id/acknowledge` | Commit: score/health + hero resting + incident → completed        |
| GET    | `/api/v1/heroes`                    | All heroes with current state                                     |
| GET    | `/api/v1/sse?sessionId=`            | Open SSE stream                                                   |

---

## Hero Stats

Defined in `frontend/src/config/statMeta.ts` — single source of truth for keys, labels, abbreviations, colors, and lucide icons used everywhere stats are displayed.

| Stat     | Abbr | Color     | Icon    | Meaning                    |
| -------- | ---- | --------- | ------- | -------------------------- |
| Threat   | THR  | `#ef4444` | Flame   | Physical force             |
| Grit     | GRT  | `#f97316` | Shield  | Durability                 |
| Presence | PRS  | `#a78bfa` | Eye     | Charisma / crowd control   |
| Edge     | EDG  | `#60a5fa` | Cpu     | Intelligence / tech        |
| Tempo    | TMP  | `#34d399` | Zap     | Speed / reflexes           |

## Hero Status

**Availability:** `available` | `on_mission` | `resting`

**Health:** `healthy` | `injured` (longer cooldown) | `down` (permanent, cooldownUntil = null)

**Cooldowns:** healthy resting ~30s | injured ~90s | down = never auto-recovered

---

## Roster

| #   | Hero              | Alias        | Threat | Grit | Presence | Edge | Tempo |
| --- | ----------------- | ------------ | ------ | ---- | -------- | ---- | ----- |
| 1   | Dominic Marchetti | Deal         | 1      | 2    | 7        | 5    | 2     |
| 2   | Kira Solberg      | Zenith       | 6      | 5    | 4        | 2    | 6     |
| 3   | Felix Voss        | Fracture     | 4      | 2    | 2        | 3    | 8     |
| 4   | Priya Sharma      | Veil         | 1      | 2    | 8        | 3    | 3     |
| 5   | Rex               | Rex          | 8      | 8    | 1        | 1    | 2     |
| 6   | Agnes Morrow      | Mother Agnes | 1      | 6    | 5        | 4    | 1     |
| 7   | Aleksei Drav      | Coil         | 8      | 3    | 2        | 5    | 4     |
| 8   | Remi Blanc        | Aegis        | 6      | 7    | 3        | 8    | 3     |
| 9   | Dorian Hess       | Chorus       | 4      | 4    | 5        | 5    | 4     |

Full `personality` (HeroReportAgent system prompt) and `bio` (NarrativePickAgent + DispatcherAgent reasoning) in `backend/src/db/seed/heroes/v2/<alias>.ts`.

---

## UI

Comic book aesthetic, dark theme.

```
┌─────────────────────────────────────────────────────────────┐
│  VIGIL SDN          ▓▓▓▓▓▓▓▓▓▓░░  87 HP      SCORE: 240   │  ← header (always visible)
├──────────────────────────────────────┬──────────────────────┤
│                                      │                      │
│         CITY MAP                     │  SDN COMMS           │
│    (static aerial image)             │  ──────────────────  │
│                                      │  > Analyzing...      │
│   ◉ pin   ◉ pin   ◉ pin              │  > Static en route   │
│                                      │  > FAILURE           │
│                                      │  > Eval 3/10 poor    │
│                                      │  [CRT effect, amber] │
├──────────────────────────────────────┴──────────────────────┤
│  ROSTER (hidden until shift starts)                          │
│  [Deal]  [Zenith]  [Fracture]  [Veil]  [Rex]  [Aegis] ...  │
└─────────────────────────────────────────────────────────────┘
```

**Incident Modal:** single scrollable column — description at top, FIELD INTEL section (divider + hint bullets with danger-color `▸` markers) in the middle, hero slots + dispatch button at the bottom. Width: `max-w-xl`. Backdrop click or X closes. Single "Dispatch" button — no confirm step.

**Interrupt Modal:** does **not** auto-open. When `mission:interrupt` SSE arrives the pin switches to ACT NOW state — player clicks it when ready. Opening the modal pauses the game; closing it (X) resumes without failing the mission. The interrupt timer (`interruptDurationMs`) is tracked in the store from `interruptCreatedAt` and shown as a thick countdown ring on the ACT NOW pin. Timer only expires if the player never opens the modal — auto-fail fires from the backend when `waitForChoice` times out. Shows `interruptState.trigger` sentence above "Select an approach" when not yet resolved. Single click on an option submits immediately — no confirm step. After choice: stat icons slide in on all options; chosen option shows a count-up roll animation (number climbs to combined value, then color shifts green/red). Auto-closes after 7 seconds. If a second interrupt fires while one is pending, it queues — shown after the current one closes.

**Debrief Modal:** opens on pin click when incident is in `debriefing` state. Shows eval section labeled "DISPATCH ANALYSIS — hero selection vs. incident demands" (score + verdict), then hero field reports (tabbed if multiple heroes). Click backdrop or X to dismiss — no explicit confirm button.

**Shift End Screen:** full-screen overlay when `sessionComplete || gameOver`. Shows SDN — SHIFT COMPLETE header, grade letter (96px), grade label, score, city HP, and "End Shift" button. framer-motion fade-in. Grade → `handleEndShift()` → back to `/shift`.

**Hero Detail Modal:** two-column layout — large portrait left (260px, with health badge + name/alias/labels pinned at bottom), right side has age/height, availability badge, bio text, Recharts `RadarChart` showing all 5 stats (amber zone, animated), stat value pills, and mission record. Opens from roster or incident modal hero click. Pauses game while open.

**City health bar** — top of screen. Segmented bar. Below ~30% segments flicker.

**Colors:**
- Background: `#08080f`
- Panel borders: `#1e1e2e`
- Danger 1 (minor): `#22c55e` (green)
- Danger 2 (standard): `#f97316` (orange)
- Danger 3 (major): `#ef4444` (red)
- Log text: `#fbbf24` (amber)
- Deployed highlight: `#3b82f6`

---

## Frontend Architecture

### Libraries

| Library | Role |
|---|---|
| Next.js App Router | Framework |
| Tailwind CSS | Styling — stylized dark aesthetic done manually |
| TanStack Query | Server state — heroes list (invalidated after mission:outcome), session hydration |
| Zustand | Client game state — all SSE-driven state lives here |
| @dnd-kit/core | Drag-and-drop for hero portraits into dispatch slots |
| framer-motion | Modal animations, stat roll animation, pin transitions |
| lucide-react | Stat icons (Flame, Shield, Eye, Cpu, Zap) |
| vault66-crt-effect | CRT/scanline effect on the SDN Comms log panel |

### State (Zustand `stores/gameStore.ts`)

```
sessionId
cityHealth, score
incidents[]              — active map pins
logEntries[]             — append-only SDN log
heroStates               — Record<heroId, { availability, health, cooldownUntil }>
interruptState           — active interrupt (null when none)
interruptQueue[]         — queued interrupts if one is already active
missionOutcomes          — Record<incidentId, MissionOutcomeState>
incidentSlots            — Record<incidentId, slotId> — stable map slot assignment (assigned in addIncident, freed in removeIncident)
incidentHeroes           — Record<incidentId, heroId[]> — which heroes are on each mission (set on dispatch, used by HeroTravelers)
uiPaused                 — true while any modal is open (controls game logic + backend pause)
pausedAt                 — wall-clock ms when pause started, null when not paused (controls visual freeze)
gameOver, sessionComplete, finalScore
```

**`MissionOutcomeState.outcome`** is `"success" | "failure" | null`. It starts `null` for non-interrupt missions and is populated when the player clicks ROLL (the `/roll` API response is written to the store via `setOutcomeRevealed`). For interrupt missions outcome is set immediately from the `mission:outcome` SSE.

**Pause tracking — full freeze system:**

The store has two pause fields: `uiPaused: boolean` and `pausedAt: number | null`.

- `setUiPaused(true)` → sets both: `uiPaused = true`, `pausedAt = Date.now()`. Also fires `POST /pause` to backend.
- `setUiPaused(false)` → sets only `uiPaused = false`. Does **not** clear `pausedAt` — visual timers stay frozen.
- `clearPausedAt()` → sets `pausedAt = null`. This is what actually unfreezes the visual display.

**Why two separate fields:** `uiPaused` controls game logic (backend pause, interrupt gate). `pausedAt` controls the visual freeze. They are cleared at different times so that visual timers never show a wrong intermediate value.

**Freeze mechanics (frontend):**

`TimerRing` and `useCooldownDisplay` both use **two separate `useEffect` hooks** with non-overlapping dependency arrays:

1. **Freeze effect** — deps: `[pausedAt]` only. When `pausedAt` becomes non-null, captures the display value at that exact moment. Does NOT re-run when `expiresAt` or `cooldownUntil` changes. This is critical — it means SSE updates that arrive while the player is in a modal (e.g. `incident:timer_extended`, `hero:state_update`) cannot corrupt the frozen display.

2. **Tick effect** — deps: `[expiresAt, pausedAt]` (ring) or `[cooldownUntil, pausedAt]` (hero). When `pausedAt !== null`, returns early — no interval starts. When `pausedAt === null`, starts ticking. Re-runs when the value prop changes so it picks up updated values after resume.

**Resume sequence:**

1. `resumeGame()` calls `setUiPaused(false)` — game logic resumes, `pausedAt` stays set, timers still frozen.
2. `api.sessions.resume()` fires (fire-and-forget) — backend extends `expiresAt` and `cooldownUntil`, emits SSE.
3. `incident:timer_extended` SSE arrives → `updateIncidentExpiry()` updates `expiresAt` in store → `clearPausedAt()` is called → tick effect re-runs with correct `expiresAt` and live `Date.now()` → no snap.
4. 500ms fallback timeout also calls `clearPausedAt()` in case there are no pending incidents (no `incident:timer_extended` will fire).

The key invariant: **`pausedAt` is never cleared before `expiresAt` is correct in the store**. The SSE update and the unfreeze happen atomically in the same handler.

**Interrupt queue:** `setInterrupt` checks if an unresolved interrupt is already active — if so, pushes to `interruptQueue` instead of replacing. `clearInterrupt` dequeues the next one automatically.

**Session end:** `setSessionComplete(finalScore)` sets `sessionComplete: true`. `setGameOver(finalScore)` sets `gameOver: true`. Either triggers `ShiftEndScreen` overlay.

### Component Tree

```
app/
  page.tsx                      # Server redirect → /shift
  shift/
    page.tsx                    # Pre-shift: GameLayout (shiftStarted=false) + StartScreen overlay
    [sessionId]/
      page.tsx                  # Active game — full DndContext + modals + ShiftEndScreen
  layout.tsx
  providers.tsx
components/
  game/
    GameLayout.tsx              # Header + map area + log panel + roster (roster hidden if !shiftStarted)
    GameHeader.tsx              # Top HUD — branding, city health bar, score, volume, end shift button
    CityMap.tsx                 # Static image + IncidentPin per active incident + HeroTravelers
    HeroTravelers.tsx           # Hero portrait avatars animating from HQ to incident pins (en_route/active only)
    IncidentPin.tsx             # Danger color, SVG countdown ring, ACT NOW state for interrupt
    LogPanel.tsx                # CRT-wrapped SDN Comms log
    RosterBar.tsx               # Bottom strip of hero portraits
    HeroPortrait.tsx            # Portrait + availability state + cooldown ring; linked prop for personal arc highlight
    StartScreen.tsx             # Overlay shown before shift starts
    ShiftEndScreen.tsx          # Overlay on session:complete or game:over — grade + stats
  modals/
    IncidentModal.tsx           # Incident briefing, field intel hints, hero slot drag targets, dispatch
    InterruptModal.tsx          # Modal shell — trigger text, option list, auto-close after resolution
    InterruptOptionRow.tsx      # OptionRow + StatRoll + StatBadge sub-components (extracted from InterruptModal)
    RollRevealModal.tsx         # Calls POST /roll on mount, radar chart + cursor animation, sets outcome in store
    DebriefModal.tsx            # Dispatch analysis eval, hero field reports; acknowledge fires on close
    HeroDetailModal.tsx         # Two-column: portrait left, radar chart + bio right
hooks/
  useSSE.ts                     # EventSource → Zustand writes
  useSession.ts                 # TanStack Query for session state
  useHeroes.ts                  # TanStack Query for heroes list
  useGameModals.ts              # All modal state + pause/resume + incident/hero/drag handlers
stores/
  gameStore.ts
config/
  statMeta.ts                   # STAT_META + STAT_META_BY_KEY — icons, colors, labels for all 5 stats
  cityLocations.ts              # Fixed x/y % slot positions on map image
types/
  api.ts                        # Frontend types — all IDs are string (UUID)
```

### City Map

Static background image (`/map.webp`, generated via Replicate — dark aerial city, noir aesthetic). 15-20 fixed `{ id, x, y }` positions in `lib/cityLocations.ts` — anonymous gameplay slots. Slot assignment is stored in `incidentSlots` in the Zustand store (keyed by incidentId) so pins don't shift when other incidents are removed. Backend has no concept of location.

**HeroTravelers:** when heroes are dispatched, their portrait avatars animate from a fixed HQ marker (bottom-center of map) to the incident pin over ~11 seconds (matching the 12s backend travel sleep). Multiple heroes spread horizontally above the pin so they don't overlap the status label. Portraits are visible only during `en_route` and `active` states — they disappear when the incident enters `debriefing`. Hero travel is **not** affected by the UI pause system (backend travel is a fire-and-forget sleep, cannot be paused).

### InterruptOption type

```typescript
interface InterruptOption {
  id: string;
  text: string;
  isHeroSpecific: boolean;
  requiredStat?: string;   // stat key — only present after resolution (not in pre-choice options)
  requiredValue?: number;  // threshold — only present after resolution
}
```

Pre-choice SSE sends text + `isHeroSpecific` only. Post-choice SSE (`mission:interrupt:resolved`) sends full options including `requiredStat`/`requiredValue`.

### SSE → UI Event Map

| SSE Event | UI Effect |
|---|---|
| `incident:new` | Pin drops onto map |
| `incident:active` | Pin label updates from EN ROUTE → ON SCENE |
| `incident:expired` | Pin removed from map |
| `incident:timer_extended` | Updates `expiresAt` in store, then calls `clearPausedAt()` — ring unfreezes only after value is correct |
| `mission:interrupt` | Pin switches to ACT NOW state (red diamond + countdown ring); game does NOT auto-pause. Player clicks ACT NOW pin to open interrupt modal and pause. |
| `mission:interrupt:resolved` | Stat icons slide in on all options; count-up roll on chosen option |
| `mission:outcome` | For non-interrupt: pin shows ROLL + ▼ CLICK (roll reveal pending). For interrupt: pin shows DEBRIEF + ▼ CLICK directly. |
| `hero:state_update` | Portrait updates state, cooldown ring starts if resting |
| `session:update` | Health bar and score counter animate |
| `game:over` | ShiftEndScreen overlay appears |
| `session:complete` | ShiftEndScreen overlay appears |
| `log` | New entry typewriters into SDN Comms panel |

---

## Game Mode

- Sessions are **finite** — `SessionArcAgent` sets `incidentLimit` (varies by arc design)
- Session ends naturally when all incidents are resolved after the limit is reached (`session:complete`)
- Session ends early if city health reaches 0 (`game:over`)
- No auth — session ID in URL (`/shift/:id`), created fresh on "Start Shift"
- Spawn pressure: new incident every ~45–60s (randomized per tick), max 4 on map simultaneously
- Danger level never shown as a number — only as pin color (green/orange/red)

**Incident lifecycle:** `pending` → `en_route` → `active` → `debriefing` → `completed` | `expired`

`debriefing` — mission finished, pin stays on map. For non-interrupt missions the pin first shows **ROLL** — player clicks to open `RollRevealModal`. The modal calls `POST /incidents/:id/roll` on mount, which reads the pre-computed outcome + roll + stats from the DB (no side effects). Once data loads, the radar chart + cursor animation plays, `setOutcomeRevealed()` writes outcome/roll/stats into the store and flushes the SDN log entry, and the pin transitions to **DEBRIEF**. For interrupt missions `rollRevealed` is set immediately from the `mission:outcome` SSE (reveal already happened in the interrupt modal), so pin goes straight to DEBRIEF. Player clicks DEBRIEF pin → debrief modal (eval + hero reports) → closes → `POST /:id/acknowledge`.

**`POST /incidents/:id/acknowledge`** is the commit point for all mission consequences: applies score/health (`dockCityHealth` or `addScore`), transitions heroes to `resting` (computes new health + cooldown), emits `hero:state_update` × N and `session:update` SSE, then marks incident `completed`. Heroes stay `on_mission` in the store until this point — no spoilers before the player has seen the outcome.

**Roll reveal modal (`RollRevealModal`):** accepts `incidentId`, fetches roll data from API on mount. Recharts `RadarChart` with two overlapping `Radar` layers — orange for required stats, blue for dispatched combined stats. Below: a two-zone bar (green = success window left, red = failure zone right) with an animated cursor that slides to the `roll` position. Cursor color flips green/red on landing, outcome badge appears. Backdrop dismissable only after animation completes.

---

## Future

- Auth + leaderboards
- Hero progression + skills
- Create your own hero
- Campaign / story mode
