# Vigil — Incident Dispatcher

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

## Branch strategy

- **`main`** — pure agent/game system. Only receives backend / pipeline / game-loop work.
- **`dev`** — full product (landing, auth, tiers, shift roster picker). Ahead of main by the product layer. Everything product/UX lives here.
- Agent improvements land on `main`, then `dev` pulls via `git merge main`. Product work never touches `main`.

---

## Before touching code

- **Backend / agents / pipelines / DB / MCP** → also read `backend/CLAUDE.md`. Contains agent roles, pipeline ordering rules, MCP per-request rule, mission outcome formulas, pause-aware game loop, critical invariants.
- **Frontend / stores / UI / SSE consumers** → also read `frontend/CLAUDE.md`. Contains store shape, pause/freeze mechanics, SSE→UI mapping, modal conventions, Tailwind v4 token system.
- **Design ideas / backlog** → `ideas.txt` at repo root.

---

## Cross-cutting conventions

**Layering:**

- `route → handler → db/queries` — routes are thin wiring only; handlers call named query functions, never raw Drizzle.
- `db/queries/` is the single source of truth for all DB access — handlers, services, pipelines, MCP tools all go through it.
- Services (`city-health.ts`, `game-loop.ts`, `cooldown-resolver.ts`) call `db/queries/` for DB ops; pure logic stays in `outcome.ts`, `cooldown.ts`, `interrupt-gate.ts`.
- Pipelines (`agents/pipelines/`) orchestrate agents — **no agent calls another agent directly**.
- MCP tools call query functions directly; no intermediate handler layer.

**Migrations:**

- Always `make generate name=<migration_name>`. Never hand-write SQL migration files.

---

## Where things live

| Area                    | Path                                     |
| ----------------------- | ---------------------------------------- |
| Agents + pipelines      | `backend/src/agents/` + `.../pipelines/` |
| DB queries              | `backend/src/db/queries/`                |
| DB seed (heroes)        | `backend/src/db/seed/heroes/v2/`         |
| Services (pure logic)   | `backend/src/services/`                  |
| MCP tools               | `backend/src/mcp/tools/`                 |
| Express routes/handlers | `backend/src/api/v1/`                    |
| Game store (Zustand)    | `frontend/src/stores/gameStore.ts`       |
| SSE client              | `frontend/src/hooks/useSSE.ts`           |
| Game UI                 | `frontend/src/components/game/`          |
| Modals                  | `frontend/src/components/game/modals/`   |
| Stat tokens (icons/etc) | `frontend/src/config/statMeta.ts`        |
| City map slots          | `frontend/src/config/cityLocations.ts`   |

Folder structures, API route lists, SSE payload shapes, hero stats, and component trees live in the code — read the files, they're authoritative.
