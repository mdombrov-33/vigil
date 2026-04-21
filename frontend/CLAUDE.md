# Vigil Frontend

Next.js App Router. Game state is Zustand (all SSE-driven state); TanStack Query for server-fetched data (heroes, session hydration). DnD via `@dnd-kit/core`. Animations via `framer-motion`. Stat icons via `lucide-react`.

## Read the root `CLAUDE.md` first.

## Critical invariants

**Pause is two fields, not one.**

- `uiPaused: boolean` — controls game logic (fires backend pause, freezes interrupt gate).
- `pausedAt: number | null` — wall-clock ms when pause started. Controls the visual freeze.

They are cleared at different times. `setUiPaused(false)` resumes game logic but leaves `pausedAt` set — timers stay frozen until `clearPausedAt()` runs AFTER the SSE `incident:timer_extended` has written the new `expiresAt` into the store. If you clear `pausedAt` before `expiresAt` updates, the timer ring snaps.

**Timer freeze = two non-overlapping `useEffect` hooks.**

Used in `TimerRing` and `useCooldownDisplay`:

1. **Freeze effect** — deps: `[pausedAt]` only. Captures display value at pause moment. Does NOT re-run when `expiresAt` or `cooldownUntil` changes. Critical: SSE updates arriving during a modal cannot corrupt the frozen display.
2. **Tick effect** — deps: `[expiresAt, pausedAt]` (ring) or `[cooldownUntil, pausedAt]` (hero). Returns early when `pausedAt !== null`. When it becomes null, starts ticking with the latest value.

Don't merge these into one effect. Don't add `expiresAt` to the freeze effect's deps. Both mistakes reintroduce the snap bug.

**Acknowledge is the commit point.**

`POST /incidents/:id/acknowledge` applies score/health, transitions heroes to `resting`, emits `hero:state_update` + `session:update`, and marks the incident `completed`. Heroes stay `on_mission` in the store until this point — no spoilers before the player has read the debrief. Don't telegraph mission outcome anywhere before this runs.

**Non-interrupt mission outcome is revealed on ROLL click, not on SSE.**

`mission:outcome` SSE for non-interrupt missions OMITS the `outcome` field. Pin shows ROLL → player clicks → `RollRevealModal` fetches from `POST /roll` → `setOutcomeRevealed()` writes outcome into store and flushes SDN log entry → pin flips to DEBRIEF. For interrupt missions, outcome already revealed in the interrupt modal, so pin goes straight to DEBRIEF.

**HeroTravelers are NOT pausable.** The backend 12s travel sleep is fire-and-forget — can't be paused. Portrait animations from HQ to pin complete independently of `uiPaused`.

---

## Zustand store shape (`stores/gameStore.ts`)

```
sessionId, cityHealth, score
incidents[]               — active map pins
logEntries[]              — append-only SDN log
heroStates                — Record<heroId, { availability, health, cooldownUntil }>
interruptState            — active interrupt (null when none)
interruptQueue[]          — queued if one already active; clearInterrupt dequeues automatically
missionOutcomes           — Record<incidentId, MissionOutcomeState>. `outcome` null until ROLL reveal.
incidentSlots             — incidentId → cityLocations slot id (stable, assigned on addIncident)
incidentHeroes            — incidentId → heroIds (set on dispatch, used by HeroTravelers)
uiPaused, pausedAt        — see pause invariants above
gameOver, sessionComplete, finalScore
```

**Interrupt queue:** `setInterrupt` checks if an unresolved interrupt is already active. If so, pushes to `interruptQueue` instead of replacing. `clearInterrupt` auto-dequeues next.

---

## SSE → UI event mapping

| SSE Event                        | UI Effect                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `incident:new`                   | Pin drops.                                                                                                                 |
| `incident:active`                | Pin label EN ROUTE → ON SCENE.                                                                                             |
| `incident:expired`               | Pin removed.                                                                                                               |
| `incident:timer_extended`        | Updates `expiresAt`, THEN calls `clearPausedAt()`. Order is load-bearing.                                                  |
| `mission:interrupt`              | Pin → ACT NOW state; game does NOT auto-pause. Player clicks ACT NOW to open modal + pause.                                |
| `mission:interrupt:resolved`     | Stat icons slide in; count-up roll on chosen option.                                                                       |
| `mission:outcome`                | Non-interrupt: pin shows ROLL. Interrupt: pin shows DEBRIEF directly. Outcome field omitted for non-interrupt — see above. |
| `hero:state_update`              | Portrait state + cooldown ring.                                                                                            |
| `session:update`                 | Health bar + score animate.                                                                                                |
| `game:over` / `session:complete` | ShiftEndScreen overlay.                                                                                                    |
| `log`                            | New entry typewriters into SDN Comms.                                                                                      |

---

## Modal conventions

- **No two-step confirm.** One click = done. Interrupt options submit on click (no confirmation). Debrief dismissed via backdrop or X (no Acknowledge button — closing fires the acknowledge API).
- **Backdrop + X both dismiss.** Don't make users hunt for a close button.
- **Opening a modal pauses the game** (`setUiPaused(true)`). Closing resumes.

---

## Tailwind v4 token system

No `tailwind.config.js`. `globals.css` uses `@theme inline { ... }` with `--color-*`, `--font-*`, etc. prefixes — these generate utilities automatically.

Check `src/app/globals.css` before using `text-[var(--x)]`. If the token is aliased in `@theme` (e.g. `--color-muted-text: var(--text-muted)`), use the short form:

- ✅ `text-muted-text` / `bg-background` / `border-border-subtle`
- ❌ `text-[var(--text-muted)]` / `bg-[var(--background)]` / `border-[var(--border-subtle)]`

Only use `[var(--x)]` arbitrary form when the token is NOT aliased in `@theme` (e.g. `--text-hi`, `--font-display` currently have no alias).

**Inline `style` is still correct for:**

- Gradients (`repeating-linear-gradient`, `radial-gradient`)
- Per-instance CSS vars (`["--hc" as string]: c.hc`)
- Ternary-driven values where both branches differ
- `mixBlendMode`, `oklch()`, `backdropFilter`

Don't inline static typography, static `rgba()` backgrounds, or static positioning — those go in classes.

---

## Incident lifecycle UI

`pending` → `en_route` → `active` → `debriefing` → `completed` | `expired`

Pin label transitions in `debriefing`:

- Non-interrupt: shows **ROLL** → click opens `RollRevealModal` → after `setOutcomeRevealed` → pin flips to **DEBRIEF**.
- Interrupt: pin shows **DEBRIEF** immediately (reveal already happened in interrupt modal).

`DebriefModal` close → `POST /acknowledge` → incident → `completed`, pin removed.
