# Vigil — Incident Dispatcher

> Last updated: 2026-03-31

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

---

## Repo Structure

```
vigil/
├── backend/
│   └── src/
│       ├── agents/                # One file per agent + pipeline.ts + mcp.ts + models.ts + schemas.ts
│       ├── api/v1/
│       │   ├── routes/            # Thin Express routers only
│       │   └── handlers/          # Business logic called by routes
│       ├── db/                    # Schema, enums, client, migrations, seed
│       │   ├── schema.ts
│       │   ├── enums.ts
│       │   ├── client.ts
│       │   ├── index.ts
│       │   ├── migrations/
│       │   └── seed/
│       │       ├── heroes/        # One file per hero (alias as filename)
│       │       ├── heroes.ts
│       │       └── index.ts
│       ├── mcp/                   # MCP server mounted at /mcp — McpServer created per-request
│       │   ├── router.ts          # Express router wiring
│       │   ├── tools/             # One file per MCP tool
│       │   └── handlers/          # DB logic called by tools
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

- `route → handler → service / db` — routes are thin wiring only
- Services are pure logic — no DB calls except `city-health.ts` and `game-loop.ts` which coordinate cross-cutting concerns
- Agents are orchestrated by `pipeline.ts` — no agent calls another agent directly
- MCP: `router → tool → handler → db` — tools never touch DB directly

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
| **IncidentGeneratorAgent** | fast  | no  | Generates incident title + description (flavor only). No game mechanics.                                                      |
| **TriageAgent**            | fast  | no  | Extracts required stats (1–3 only), slot count, danger level, timing, interrupt options from description.                     |
| **NarrativePickAgent**     | full  | no  | Picks `topHeroId` based on hero bio/powers/character fit — not stats. Used for interrupt hero-specific option.                |
| **DispatcherAgent**        | fast  | yes | Stores hidden stat-based recommendation via `save_dispatch_recommendation`.                                                   |
| **HeroReportAgent**        | full  | yes | One instance per hero, personality as system prompt. Calls `get_hero_mission_history`, writes 3-sentence first-person report. |
| **ReflectionAgent**        | fast  | no  | Reviews hero report — rejects only for wrong voice, generic content, or outcome mismatch. Max 2 iterations.                   |
| **EvalAgent**              | full  | yes | Calls `get_dispatch_recommendation`, compares to player dispatch, scores 0–10, outputs verdict + postOpNote.                  |

**Two separate hero rankings:**

- **Stat-based** (`scoreHeroes`) → dispatcher recommendation, eval grading
- **Narrative-based** (`NarrativePickAgent`) → `topHeroId` on incident, unlocks hero-specific interrupt option

---

## Pipelines

### Incident Creation Pipeline (`runIncidentCreationPipeline`)

```
1. IncidentGeneratorAgent + fetch available heroes   [parallel]
2. TriageAgent + NarrativePickAgent                  [parallel]
3. scoreHeroes() — deterministic stat ranking        [pure code]
4. INSERT incident → DB
5. DispatcherAgent → save_dispatch_recommendation
6. SSE: incident:new → pin appears on map
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

TYPE 2 — Interrupt:
  8a. sleep(missionDuration / 2)
  8b. SSE: mission:interrupt — options with text only (no stat info), topHeroId included
  8c. waitForChoice(missionId, sessionId, remainingMs) — pause-aware polling loop
  8d. If timeout → auto-fail
  8e. getInterruptOutcome() — stat check or hero-specific check
  8f. SSE: mission:interrupt:resolved — full options with requiredStat/requiredValue, outcome, combinedValue

9.  If failure → dockCityHealth(-10)
10. UPDATE incident → debriefing, heroes → missionsCompleted/Failed counters
11. HeroReportAgent × N                              [parallel]
12. ReflectionAgent × N                              [parallel]
13. UPDATE missionHeroes.report per hero
14. UPDATE missions.outcome + completedAt
15. UPDATE heroes → resting + cooldownUntil
16. SSE: hero:state_update × N
17. EvalAgent → score/verdict/explanation/postOpNote
18. If success → addScore() based on verdict
19. UPDATE missions eval columns
20. SSE: mission:outcome + log with eval score
```

---

## SSE Events

One persistent connection per session: `GET /api/v1/sse?sessionId=xxx`

| Event                        | When                              | Payload                                                                                                          |
| ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `log`                        | Throughout pipeline               | `{ message }`                                                                                                    |
| `incident:new`               | Incident pipeline complete        | `{ incidentId, title, description, slotCount, dangerLevel, hasInterrupt, createdAt, expiresAt }`                 |
| `incident:active`            | After travel sleep                | `{ incidentId }`                                                                                                 |
| `incident:expired`           | Expiry timer fires                | `{ incidentId }`                                                                                                 |
| `mission:interrupt`          | Halfway through missionDuration   | `{ incidentId, missionId, topHeroId, heroIds, options }` (text only, no stats)                                   |
| `mission:interrupt:resolved` | After player choice               | `{ incidentId, missionId, chosenOptionId, outcome, combinedValue, options }` (full options with stat info)       |
| `mission:outcome`            | Mission pipeline complete         | `{ incidentId, missionId, outcome, title, heroes, evalScore, evalVerdict, evalPostOpNote }`                      |
| `hero:state_update`          | After hero state changes          | `{ heroId, alias, availability, health, cooldownUntil }`                                                         |
| `session:update`             | After city health or score change | `{ cityHealth, score }`                                                                                          |
| `game:over`                  | cityHealth reaches 0              | `{ finalScore }`                                                                                                 |

**SSE manager** (`backend/src/sse/manager.ts`): `send(sessionId, event, data)` for session-scoped events, `broadcast(event, data)` for global (cooldown resolver uses broadcast since heroes are global).

---

## Game Loop (`services/game-loop.ts`)

Runs every 5s per active SSE session. Skips entirely if session is paused.

- **Expiry check** — finds `pending` incidents where `expiresAt < now`, marks `expired`, docks -15 city health, emits `incident:expired`
- **Spawn check** — auto-generates new incident every 45-60s if active incidents < 4

Exports: `pauseSession(id)`, `resumeSession(id)`, `isSessionPaused(id)` — used by pause/resume API endpoints and the interrupt gate.

**Cooldown resolver** (`services/cooldown-resolver.ts`) — separate 5s interval, finds `resting` heroes where `cooldownUntil <= now` AND `cooldownUntil IS NOT NULL` (excludes `down` heroes), flips to `available`, broadcasts `hero:state_update`.

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
return Math.random() < successChance ? "success" : "failure";
```

Triage sets only 1–3 relevant stats. All-stat padding wrecks the formula by averaging away gaps.

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

---

## MCP Server

Mounted on `/mcp` inside the backend process (`src/mcp/router.ts`). **Critical:** `McpServer` instance is created fresh per request (not shared) — sharing caused "Already connected to transport" errors.

```
Agent (backend) → MCPServerStreamableHttp → localhost:{PORT}/mcp → handler → Drizzle → Postgres
```

| Tool                           | Handler                       |
| ------------------------------ | ----------------------------- |
| `get_available_heroes`         | `handlers/heroes.ts`          |
| `get_hero_profile`             | `handlers/heroes.ts`          |
| `get_hero_mission_history`     | `handlers/heroes.ts`          |
| `update_hero_state`            | `handlers/heroes.ts`          |
| `save_mission_report`          | `handlers/missions.ts`        |
| `save_dispatch_recommendation` | `handlers/recommendations.ts` |
| `get_dispatch_recommendation`  | `handlers/recommendations.ts` |

---

## API Routes

| Method | Path                                | Description                                                       |
| ------ | ----------------------------------- | ----------------------------------------------------------------- |
| POST   | `/api/v1/sessions`                  | Create session                                                    |
| GET    | `/api/v1/sessions/:id`              | Get session state (cityHealth, score)                             |
| POST   | `/api/v1/sessions/:id/start`        | Start game loop, reset heroes + stale incidents for this session  |
| POST   | `/api/v1/sessions/:id/pause`        | Pause game loop + interrupt timer for this session                |
| POST   | `/api/v1/sessions/:id/resume`       | Resume game loop + interrupt timer                                |
| GET    | `/api/v1/incidents?sessionId=`      | Active incidents for map (pending/en_route/active/debriefing)     |
| GET    | `/api/v1/incidents/:id`             | Single incident detail                                            |
| POST   | `/api/v1/incidents/generate`        | Manually trigger incident creation pipeline                       |
| POST   | `/api/v1/incidents/:id/dispatch`    | Dispatch heroes — locks immediately, pipeline fires in background |
| POST   | `/api/v1/incidents/:id/interrupt`   | Submit interrupt choice                                           |
| GET    | `/api/v1/incidents/:id/debrief`     | Hero reports for debrief modal                                    |
| POST   | `/api/v1/incidents/:id/acknowledge` | Move incident debriefing → completed, clear from map              |
| GET    | `/api/v1/heroes`                    | All heroes with current state                                     |
| GET    | `/api/v1/sse?sessionId=`            | Open SSE stream                                                   |

---

## Hero Stats

Defined in `frontend/src/lib/statMeta.ts` — single source of truth for keys, labels, abbreviations, colors, and lucide icons used everywhere stats are displayed.

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

| #   | Hero           | Alias        | Threat | Grit | Presence | Edge | Tempo |
| --- | -------------- | ------------ | ------ | ---- | -------- | ---- | ----- |
| 1   | Marcus Cole    | Ironwall     | 9      | 10   | 5        | 4    | 2     |
| 2   | Zara Osei      | Static       | 3      | 4    | 6        | 10   | 6     |
| 3   | Danny Kowalski | Boom         | 9      | 7    | 4        | 3    | 5     |
| 4   | Priya Sharma   | Veil         | 2      | 4    | 10       | 8    | 4     |
| 5   | Rex            | Rex          | 10     | 10   | 1        | 3    | 3     |
| 6   | Felix Voss     | Fracture     | 6      | 5    | 7        | 5    | 10    |
| 7   | Agnes Morrow   | Mother Agnes | 1      | 5    | 9        | 7    | 2     |
| 8   | Kai Park       | Null         | 5      | 6    | 4        | 8    | 7     |
| 9   | Diana Vance    | Duchess      | 8      | 6    | 5        | 9    | 6     |

Full `personality` (HeroReportAgent system prompt) and `bio` (NarrativePickAgent + DispatcherAgent reasoning) in `packages/db/src/seed/heroes/<alias>.ts`.

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
│  [Ironwall]  [Static]  [Boom]  [Veil]  [Rex]  [Fracture]   │
└─────────────────────────────────────────────────────────────┘
```

**Incident Modal:** two-column layout — description left, hero slots + dispatch button right. Backdrop click or X closes. Single "Dispatch" button — no confirm step.

**Interrupt Modal:** auto-opens when `mission:interrupt` SSE arrives (game pauses automatically). Single click on an option submits immediately — no confirm step. After choice: stat icons slide in on all options; chosen option shows a count-up roll animation (number climbs to combined value, then color shifts green/red). Auto-closes after 7 seconds. X button for early dismiss. If a second interrupt fires while one is pending, it queues — shown after the current one closes.

**Debrief Modal:** opens on pin click when incident is in `debriefing` state. Shows eval score, hero field reports (tabbed if multiple heroes). Click backdrop or X to dismiss — no explicit confirm button.

**Hero Detail Modal:** portrait, stat bars with icons, bio, missionsCompleted/Failed, current status. Opens from roster (always) or from incident modal hero click. Pauses game while open.

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
uiPaused                 — true while any modal is open
pausedDuration           — accumulated ms paused (used by TimerRing for freeze-without-jump)
pausedSince              — timestamp when current pause started (null if not paused)
gameOver, finalScore
```

**Pause tracking:** `setUiPaused(true)` records `pausedSince = Date.now()`. `setUiPaused(false)` adds elapsed to `pausedDuration`, clears `pausedSince`. `TimerRing` uses `getEffectiveNow() = Date.now() - pausedDuration - inProgressPause` so rings freeze during modal opens without jumping on resume.

**Interrupt queue:** `setInterrupt` checks if an unresolved interrupt is already active — if so, pushes to `interruptQueue` instead of replacing. `clearInterrupt` dequeues the next one automatically.

### Component Tree

```
app/
  page.tsx                      # Server redirect → /shift
  shift/
    page.tsx                    # Pre-shift: GameLayout (shiftStarted=false) + StartScreen overlay
    [sessionId]/
      page.tsx                  # Active game — full DndContext + modals
  layout.tsx
  providers.tsx
components/
  game/
    GameLayout.tsx              # Header + map area + log panel + roster (roster hidden if !shiftStarted)
    CityMap.tsx                 # Static image + IncidentPin per active incident
    IncidentPin.tsx             # Danger color, SVG countdown ring, ACT NOW pulse for interrupt
    LogPanel.tsx                # CRT-wrapped SDN Comms log
    RosterBar.tsx               # Bottom strip of hero portraits
    HeroPortrait.tsx            # Portrait + availability state + cooldown ring
    CityHealthBar.tsx           # Segmented health bar in header
    StartScreen.tsx             # Overlay shown before shift starts
  modals/
    IncidentModal.tsx           # Incident briefing, hero slot drag targets, dispatch
    InterruptModal.tsx          # Interrupt options, stat roll animation, auto-close
    DebriefModal.tsx            # Mission outcome, eval score, hero field reports
    HeroDetailModal.tsx         # Hero profile with stat bars and icons
hooks/
  useSSE.ts                     # EventSource → Zustand writes
  useSession.ts                 # TanStack Query for session state
  useHeroes.ts                  # TanStack Query for heroes list
stores/
  gameStore.ts
lib/
  statMeta.ts                   # STAT_META + STAT_META_BY_KEY — icons, colors, labels for all 5 stats
  cityLocations.ts              # Fixed x/y % slot positions on map image
types/
  api.ts                        # Frontend types — all IDs are string (UUID)
```

### City Map

Static background image (`/map.webp`, generated via Replicate — dark aerial city, noir aesthetic). 15-20 fixed `{ id, x, y }` positions in `lib/cityLocations.ts` — anonymous gameplay slots. Frontend picks the first unoccupied slot for each new incident. Backend has no concept of location.

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
| `mission:interrupt` | Interrupt modal auto-opens, game pauses, pin shows ACT NOW pulse |
| `mission:interrupt:resolved` | Stat icons slide in on all options; count-up roll on chosen option |
| `mission:outcome` | Incident status → debriefing; pin shows DEBRIEF + ▼ CLICK |
| `hero:state_update` | Portrait updates state, cooldown ring starts if resting |
| `session:update` | Health bar and score counter animate |
| `game:over` | (game over handling — modal not yet built) |
| `log` | New entry typewriters into SDN Comms panel |

---

## Game Mode (MVP)

- Session runs until city health hits 0
- No auth — session ID in URL (`/shift/:id`), created fresh on "Start Shift"
- Spawn pressure: new incident every ~45–60s, max 4 on map simultaneously
- Danger level never shown as a number — only as pin color (green/orange/red)

**Incident lifecycle:** `pending` → `en_route` → `active` → `debriefing` → `completed` | `expired`

`debriefing` — mission finished, pin stays on map. Player clicks pin to read debrief, then clicks backdrop or X to dismiss. `POST /:id/acknowledge` moves to `completed` and clears the pin.

---

## Future

- Auth + leaderboards
- Shift mode (handle N incidents, get debriefed at end)
- Hero progression + skills
- Create your own hero
- Campaign / story mode
