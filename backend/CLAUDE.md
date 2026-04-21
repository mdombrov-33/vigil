# Vigil Backend

Multi-agent game backend. Agents orchestrated via pipelines, never chained directly. DB access funnels through `db/queries/`. MCP mounted on `/mcp` for agent-discoverable data.

Read the root `CLAUDE.md` first.

---

## Agents

| Agent                      | Model | MCP | Role                                                                                                                          |
| -------------------------- | ----- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| **SessionArcAgent**        | full  | no  | Generates 1–2 narrative arc seeds + incident limit at session start. Runs once.                                               |
| **IncidentGeneratorAgent** | fast  | no  | Generates incident title + description + arcId. Arc-aware via session history + arc beats.                                    |
| **TriageAgent**            | fast  | no  | Extracts required stats (1–3), slot count, danger, timing, interrupt options, hints, interruptTrigger.                        |
| **NarrativePickAgent**     | full  | no  | Picks `topHeroId` by character fit (bio/powers), not stats. Used for hero-specific interrupt option.                          |
| **DispatcherAgent**        | fast  | yes | Stores hidden stat-based recommendation via `save_dispatch_recommendation`.                                                   |
| **HeroReportAgent**        | full  | yes | One instance per hero, personality as system prompt. Calls `get_hero_mission_history`, writes 3-sentence first-person report. |
| **ReflectionAgent**        | fast  | no  | Reviews hero report against hero bio + incident. Rejects for wrong voice / generic / outcome mismatch. Max 2 iterations.      |
| **EvalAgent**              | full  | yes | Compares dispatch to recommendation, scores 0–10, outputs verdict + postOpNote.                                               |

Two independent hero rankings, both over all non-down heroes (availability ignored — the "ideal" team is independent of current deployment):
- **Stat-based** (`scoreHeroes` in `services/outcome.ts`) → dispatcher recommendation, eval grading.
- **Narrative-based** (`NarrativePickAgent`) → `topHeroId`, unlocks hero-specific interrupt option.

---

## Critical invariants

**`POST /sessions/:id/start` idempotency.** React StrictMode double-invokes effects in dev — session start is called twice. Guard: skip `SessionArcAgent` if `arcSeeds` already exists on the session row. Without this, arc generation runs twice and burns an LLM call.

**MCP `McpServer` is created fresh per request.** Sharing one instance across requests produced "Already connected to transport" errors. Don't hoist the server to module scope. See `src/mcp/router.ts`.

**Mission pipeline — do NOT fire score/health/hero-state in `mission:outcome`.** These consequences are deferred to `POST /incidents/:id/acknowledge`. Reason: the ROLL pin must appear before consequences telegraph the outcome. For non-interrupt missions the `outcome` field is omitted from the `mission:outcome` SSE — the frontend fetches it from `/roll` when the player opens the reveal. Heroes stay `on_mission` until acknowledge.

**Personal arcs skip NarrativePickAgent.** When `arcType === "personal"`, `linkedHeroAlias` is resolved to `topHeroId` for every incident in that arc. The linked hero is the subject, never placed on-scene in generated incidents.

**Incident generator pacing is deterministic.** `computePacingStatus()` in the incident pipeline produces a concrete recommendation string ("advance arc_b — needs 3 beats in 9 slots" / "standalone — no standalones yet") before the LLM call. The model is instructed to follow it. Don't treat the recommendation as a soft suggestion.

---

## Mission outcome

**Type 1 (no interrupt):** quadratic coverage formula.

```typescript
const coverage = avg(statKeys.map(s => min(combined[s] / required[s], 1.0)));
const successChance = coverage²;
const roll = Math.random();
return { outcome: roll < successChance ? "success" : "failure", roll, dispatchedStats };
```

TriageAgent picks **only 1–3 relevant stats**. All-stat padding wrecks the formula by averaging away gaps — this is intentional.

`roll` and `dispatchedStats` are stored on the `missions` row and fetched by the frontend via `POST /incidents/:id/roll` — not sent in the SSE.

**Type 2 (interrupt):**
- `isHeroSpecific: true` → success iff `topHeroId` was dispatched.
- Stat check → `combinedStat >= requiredValue` → deterministic, no randomness.
- `combinedValue` sent in `mission:interrupt:resolved` for the roll animation.

**Eval** judges dispatch quality independently of interrupt outcome — they measure different skills.

---

## Pause-aware services

**`services/game-loop.ts`** — 5s tick per active session. Skips entirely if `isSessionPaused(sessionId)` is true. Spawn interval is randomized **per tick** (45–60s, fresh `Math.random()`), not once at startup. Session completion: when `incidentCount >= incidentLimit` and no active incidents, emits `session:complete`.

**`services/cooldown-resolver.ts`** — separate 5s global interval. Session-aware: if any session is paused, heroes whose last mission belongs to a paused session are skipped. Prevents heroes recovering while the player sits in a modal.

**`services/interrupt-gate.ts`** — `waitForChoice(missionId, sessionId, timeoutMs)` polls every 200ms and only increments elapsed time when the session is NOT paused. Interrupt timer freezes with modals open.

**On resume** (`POST /sessions/:id/resume`):
1. Extend `expiresAt` for all pending incidents by `pausedMs` → emit `incident:timer_extended` per incident.
2. Extend `cooldownUntil` for all resting heroes in this session by `pausedMs` → emit `hero:state_update` per hero.

---

## DB schema — non-obvious columns

Enumerable schema is in `db/schema.ts`. These columns encode design decisions that aren't obvious from names alone:

- `sessions.arcSeeds jsonb` — ArcSeed array from SessionArcAgent; includes `linkedHeroAlias` for personal arcs.
- `sessions.sessionMood text` — one-sentence tone note passed to incident generator.
- `sessions.incidentLimit` / `incidentCount` — finite session length, set by SessionArcAgent; count incremented atomically on spawn.
- `incidents.hints jsonb` — 1–3 tiered ambiguity field intel strings from TriageAgent.
- `incidents.interruptTrigger varchar(500)` — one-sentence dispatch-voice context for interrupt modal.
- `incidents.arcId varchar(10)` / `linkedHeroAlias varchar(100)` — arc membership; `linkedHeroAlias` only set for personal arcs.
- `missions.roll real` / `dispatched_stats jsonb` — stored at mission end for non-interrupt missions only; fetched by `/roll` endpoint, not in SSE.

---

## MCP tools

`router → tool → db/queries` — no handler layer. Only for data an agent needs to **discover mid-run**. Data known at pipeline start goes in the prompt.

| Tool                           | Used by           |
| ------------------------------ | ----------------- |
| `get_hero_mission_history`     | HeroReportAgent   |
| `save_dispatch_recommendation` | DispatcherAgent   |
| `get_dispatch_recommendation`  | EvalAgent         |
