# Vigil — Incident Dispatcher

> Last updated: 2026-03-28 (backend complete)

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
| MCP Server    | Custom Node.js process, same Docker stack, port 3002    |
| Realtime      | SSE — one persistent connection per session             |
| Observability | OpenAI Agents SDK built-in traces                       |
| Deploy        | AWS (backend + MCP + RDS), Vercel (frontend)            |
| Local dev     | Docker Compose                                          |

---

## Repo Structure

```
vigil/
├── packages/
│   └── db/                        # @vigil/db — shared schema, enums, client, seed
│       └── src/
│           ├── schema.ts
│           ├── enums.ts
│           ├── client.ts
│           ├── index.ts
│           ├── migrations/
│           └── seed/
│               ├── heroes/        # One file per hero (alias as filename)
│               ├── heroes.ts
│               └── index.ts
├── backend/
│   └── src/
│       ├── agents/                # One file per agent + pipeline.ts + mcp.ts + models.ts + schemas.ts
│       ├── routes/                # Thin Express routers only
│       ├── handlers/              # Business logic called by routes
│       ├── services/              # Pure logic — outcome, cooldowns, scoring, city health, game loop
│       ├── sse/                   # SSE manager (connection registry + send/broadcast)
│       ├── tracing.ts
│       └── types/
├── mcp-server/
│   └── src/
│       ├── tools/                 # One file per MCP tool
│       ├── handlers/              # DB logic called by tools
│       └── index.ts               # McpServer created per-request (not shared instance)
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       └── types/
└── docker-compose.yml
```

**Layering rules:**

- `route → handler → service / db` — routes are thin wiring only
- Services are pure logic — no DB calls except `city-health.ts` and `game-loop.ts` which coordinate cross-cutting concerns
- Agents are orchestrated by `pipeline.ts` — no agent calls another agent directly
- MCP server: `tool → handler → db` — same layering, tools never touch DB directly

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
6. SSE: log "on scene"

TYPE 1 — No interrupt:
  7a. sleep(missionDuration)
  7b. getMissionOutcome() — quadratic coverage formula

TYPE 2 — Interrupt:
  7a. sleep(missionDuration / 2)
  7b. SSE: mission:interrupt — options with text only, no stat info, topHeroId included
  7c. waitForChoice(missionId, remainingMs) — in-memory promise, player POSTs choice
  7d. If timeout → auto-fail
  7e. getInterruptOutcome() — stat check or hero-specific check

8.  If failure → dockCityHealth(-10)
9.  UPDATE incident → completed, heroes → missionsCompleted/Failed counters
10. HeroReportAgent × N                              [parallel]
11. ReflectionAgent × N                              [parallel]
12. UPDATE missionHeroes.report per hero
13. UPDATE missions.outcome + completedAt
14. UPDATE heroes → resting + cooldownUntil
15. SSE: hero:state_update × N
16. EvalAgent → score/verdict/explanation/postOpNote
17. If success → addScore() based on verdict
18. UPDATE missions eval columns
19. SSE: mission:outcome + log with eval score
```

---

## SSE Events

One persistent connection per session: `GET /api/sse?sessionId=xxx`

| Event                        | When                              | Payload                                                                                     |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| `log`                        | Throughout pipeline               | `{ message }`                                                                               |
| `incident:new`               | Incident pipeline complete        | `{ incidentId, title, description, slotCount, dangerLevel, hasInterrupt, expiresAt }`       |
| `mission:interrupt`          | Halfway through missionDuration   | `{ incidentId, missionId, topHeroId, options }` (text only, no stats)                       |
| `mission:interrupt:resolved` | After player choice               | `{ incidentId, missionId, chosenOptionId, options }` (full options with stat info revealed) |
| `mission:outcome`            | Mission pipeline complete         | `{ incidentId, missionId, outcome, heroes, evalScore, evalVerdict, evalPostOpNote }`        |
| `hero:state_update`          | After hero state changes          | `{ heroId, alias, availability, health, cooldownUntil }`                                    |
| `session:update`             | After city health or score change | `{ cityHealth, score }`                                                                     |
| `incident:expired`           | Expiry timer fires                | `{ incidentId }`                                                                            |
| `game:over`                  | cityHealth reaches 0              | `{ finalScore }`                                                                            |

**SSE manager** (`backend/src/sse/manager.ts`): `send(sessionId, event, data)` for session-scoped events, `broadcast(event, data)` for global (cooldown resolver uses broadcast since heroes are global).

---

## Game Loop (`services/game-loop.ts`)

Runs every 5s per active SSE session:

- **Expiry check** — finds `pending` incidents where `expiresAt < now`, marks `expired`, docks -15 city health, emits `incident:expired`
- **Spawn check** — auto-generates new incident every 45-60s if active incidents < 4

**Cooldown resolver** (`services/cooldown-resolver.ts`) — separate 5s interval, finds `resting` heroes where `cooldownUntil <= now` AND `cooldownUntil IS NOT NULL` (excludes `down` heroes), flips to `available`, broadcasts `hero:state_update`.

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

Separate Express + `@modelcontextprotocol/sdk` process. **Critical:** `McpServer` instance is created fresh per request (not shared) — sharing caused "Already connected to transport" errors.

```
Agent (backend) → MCPServerStreamableHttp → mcp-server:3002/mcp → handler → Drizzle → Postgres
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

| Method | Path                           | Description                                                       |
| ------ | ------------------------------ | ----------------------------------------------------------------- |
| POST   | `/api/sessions`                | Create session                                                    |
| GET    | `/api/sessions/:id`            | Get session state (cityHealth, score)                             |
| GET    | `/api/incidents?sessionId=`    | Active incidents for map (pending/en_route/active)                |
| GET    | `/api/incidents/:id`           | Single incident detail (interrupt options hidden until active)    |
| POST   | `/api/incidents/generate`      | Manually trigger incident creation pipeline                       |
| POST   | `/api/incidents/:id/dispatch`  | Dispatch heroes — locks immediately, pipeline fires in background |
| POST   | `/api/incidents/:id/interrupt` | Submit interrupt choice                                           |
| GET    | `/api/heroes`                  | All heroes with current state                                     |
| GET    | `/api/sse?sessionId=`          | Open SSE stream                                                   |

---

## Hero Stats

- **Threat** — physical force (1–10)
- **Grit** — durability (1–10)
- **Presence** — charisma / crowd control (1–10)
- **Edge** — intelligence / tech (1–10)
- **Tempo** — speed / reflexes (1–10)

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

Full `personality` (HeroReportAgent system prompt) and `bio` (NarrativePickAgent + DispatcherAgent reasoning) in `packages/db/src/seed/heroes/<alias>.ts`. Bio is dispatcher quick-reference style — power mechanics, what makes them the obvious pick.

---

## UI

Comic book aesthetic, dark theme.

```
┌──────────────────────────────────────┬──────────────────┐
│                                      │  SDN LOG         │
│           CITY MAP                   │────────────────  │
│                                      │ Analyzing...     │
│  [●] Power Surge   [●] Bank Job      │ Incident:        │
│  [●] Collapse                        │   Power Surge    │
│                                      │ Rec: Static      │
│  pins colored by danger level        │ Eval: 9/10       │
│  pulsing = interrupt pending         │   good call      │
│                                      │ [scrollable]     │
├──────────────────────────────────────┤                  │
│  ROSTER BAR — always visible         │                  │
│  [portrait] [portrait] [portrait] ...                   │
│  Available  Resting:12s  On mission  Injured:45s  Down  │
└──────────────────────────────────────┴──────────────────┘
```

**Incident Modal:** title + description (no stat list, no danger number), hero slots, dispatch button. Roster shows stat bars while modal is open.

**Interrupt Modal:** replaces dispatch UI mid-mission. Options text only. Hero-specific option shows portrait, greyed + unselectable if that hero wasn't sent. After choice: stat icons revealed on all options.

**Hero Card:** portrait, name/alias, stat bars, bio, missionsCompleted/missionsFailed, current status.

---

## Game Mode (MVP)

- Session runs until city health hits 0
- No auth — session stored in DB, ID passed by client
- Spawn pressure: new incident every ~45–60s, max 4 on map simultaneously
- Danger level never shown as a number — only as pin color (green/yellow/red)

**Incident lifecycle:** `pending` → `en_route` → `active` → `completed` | `expired`

---

## Frontend Architecture

### Libraries

| Library | Role |
|---|---|
| Next.js App Router | Framework |
| Tailwind CSS | Styling — stylized dark aesthetic done manually |
| TanStack Query | Server state — initial hydration only, SSE drives updates |
| Zustand | Client game state — session, incidents, log, interrupt, health/score |
| Magic UI | Specific animated components: number counters, shimmer effects, text animations |
| MVP Blocks | Card/modal shells as starting point, heavily customized |
| vault66-crt-effect | CRT/terminal effect wrapping the SDN Comms log panel — scanlines, amber glow, sweep line |

The city map is **not** a real map library. It's a static background image (generated via Replicate — dark aerial city, noir/rain aesthetic) with incident pins overlaid at absolute % positions. No map SDK, no CSS grid — just an `<img>` and positioned elements on top.

### State Strategy

**TanStack Query** handles:
- `GET /api/heroes` — initial load + manual refetch (needed for stat bars in dispatch modal)
- `GET /api/sessions/:id` — initial session state
- `GET /api/incidents?sessionId=` — hydrate map on load

**Zustand** (`stores/gameStore.ts`) holds everything that SSE writes to:
- `sessionId`
- `incidents[]` — active map pins, updated by `incident:new` / `incident:expired`
- `logEntries[]` — append-only, fed by `log` SSE events
- `interruptState` — `{ incidentId, missionId, topHeroId, options } | null`
- `cityHealth`, `score` — fed by `session:update`
- `heroStates` — map of heroId → `{ availability, health, cooldownUntil }`, fed by `hero:state_update`

**`useSSE(sessionId)`** hook — opens `EventSource`, writes to Zustand on every event. Runs once when session is active.

### Component Tree

```
app/
  page.tsx                    # Session gate — create or resume session, render game
  layout.tsx
components/
  game/
    GameLayout.tsx            # Map + LogPanel + RosterBar layout
    CityMap.tsx               # Dark city grid, renders IncidentPin per active incident
    IncidentPin.tsx           # Pin with danger level color, expiry countdown, pulsing if interrupt pending
    LogPanel.tsx              # Right side, scrollable, SSE log entries fade in
    RosterBar.tsx             # Fixed bottom strip of hero portraits
    HeroPortrait.tsx          # Portrait + availability state + cooldown countdown
  modals/
    IncidentModal.tsx         # Opens on pin click — description, slot count, hero selection, dispatch
    InterruptModal.tsx        # Opens on mission:interrupt — options list, hero-specific greyed if not sent
    HeroDetailModal.tsx       # Portrait, stat bars, bio, missionsCompleted/Failed, status
    GameOverModal.tsx         # Final score, city health, restart button
  ui/                         # Shared primitives from Magic UI / MVP Blocks
hooks/
  useSSE.ts                   # EventSource → Zustand
  useSession.ts               # TanStack Query wrapper for session
  useHeroes.ts                # TanStack Query wrapper for heroes
stores/
  gameStore.ts                # Zustand store
types/
  api.ts                      # Frontend types matching backend API responses
```

### Aesthetic & Layout Vision

Reference feel: **This Is the Police** / **Dispatch** — a real ops center under pressure, not a web dashboard. The player is a dispatcher watching a city actively going wrong.

```
┌─────────────────────────────────────────────────────────────┐
│  VIGIL SDN          ▓▓▓▓▓▓▓▓▓▓░░  87 HP      SCORE: 240   │  ← minimal header
├──────────────────────────────────────┬──────────────────────┤
│                                      │                      │
│                                      │  SDN COMMS           │
│         CITY MAP                     │  ──────────────────  │
│    (generated aerial image,          │  > Analyzing...      │
│     dark, rain, neon)                │  > Static + Duchess  │
│                                      │  > en route          │
│   ◉ Kestrel Hub    ◉ Blackwell       │  > ON SCENE          │
│         ◉ Calder Annex               │  > FAILURE           │
│                                      │  > Eval 3/10 poor    │
│                                      │  > Force excessive   │
│                                      │                      │
│                                      │  [amber mono text,   │
│                                      │   typewriter in,     │
│                                      │   scanline overlay]  │
├──────────────────────────────────────┴──────────────────────┤
│  ROSTER                                                      │
│  [Ironwall]  [Static★]  [Boom]  [Veil]  [Rex]  [Fracture]  │
│  available   DEPLOYED   :28s    available  OFFLINE  :07s    │
└─────────────────────────────────────────────────────────────┘
```

**Map** — takes ~65-70% of screen. Generated aerial city image (Replicate), dark noir at night. 15-20 fixed x/y % positions defined in code — these are anonymous gameplay slots, not named locations. Incident pins are colored pulsing orbs placed at whichever slot is free. Pin colors: green (danger 1) / yellow (danger 2) / red (danger 3). When interrupt fires, pin switches to fast strobe. Pins drop in with an expanding ring on arrival, fade out on expiry.

**SDN Comms log** — right side panel wrapped in `vault66-crt-effect` (`vt100` or `dos` preset, amber theme, light scanlines). Monospace text on near-black. Lines typewrite in one character at a time. Color-coded: neutral for log, red for failure, green for success, yellow for eval notes. The CRT sweep line effect triggers naturally as new entries arrive.

**Roster bar** — fixed bottom, inspired by This Is the Police / Dispatch. Hero portrait cards in a horizontal strip. Each card shows:
- Portrait (from `portraitUrl` DB field, already seeded)
- Alias below
- Status overlay: clean = available, pulsing border = deployed, greyed + countdown ring = resting, red OFFLINE stamp = down
- Clicking opens HeroDetailModal

**Incident modal** — slides in from the pin's position on the map (not a generic centered popup). Mission briefing style: dark background, the incident title in bold, description in a worn typeface, hero slot indicators (empty circles = slots). Player clicks portraits from the roster to fill slots, dispatch button activates when at least one hero selected.

**Interrupt modal** — the tense moment. Screen dims. Options appear as stark choices, text only. Hero-specific option shows that hero's portrait beside the text — greyed + locked icon if they weren't dispatched (player sees what they missed). After choosing: stat icons burn in on all options simultaneously.

**City health bar** — top of screen. Segmented bar styled like a city skyline silhouette. Segments go dark as health drops. Below ~30% the remaining segments flicker.

**Colors:**
- Background: `#08080f`
- Panel borders: `#1e1e2e`
- Danger 1 (minor): `#22c55e`
- Danger 2 (standard): `#eab308`
- Danger 3 (major): `#ef4444`
- Log text: `#fbbf24` (amber)
- Deployed highlight: `#3b82f6`

### City Locations

15-20 fixed positions spread across the map image, defined as `{ id, x, y }[]` in `frontend/src/lib/cityLocations.ts`. These are pure gameplay slots — no names, no districts. When a new incident arrives the frontend picks the first unoccupied slot and places the pin there. The backend has no concept of location; placement is entirely a frontend concern.

### Hero Portraits

`portraitUrl` field already exists on the hero DB record. Portraits already seeded. Roster bar and modals pull from this field directly.

### SSE → UI Event Map

| SSE Event | UI Effect |
|---|---|
| `incident:new` | New pin drops onto map with animation |
| `incident:expired` | Pin disappears, brief red flash |
| `mission:interrupt` | Active pin starts fast pulse, interrupt modal queued |
| `mission:interrupt:resolved` | Stat icons animate in on all options |
| `mission:outcome` | Outcome badge appears on pin briefly before it fades |
| `hero:state_update` | Portrait transitions state, cooldown countdown starts |
| `session:update` | City health counter animates to new value |
| `game:over` | Game over modal slides in |
| `log` | New entry fades into log panel |

---

## Future

- Auth + leaderboards
- Shift mode (handle N incidents, get debriefed)
- Hero progression + skills
- Create your own hero
- Campaign / story mode
