import { Request, Response } from "express";
import { sendJson } from "@/utils/response";
import { registerSession, pauseSession, resumeSession } from "@/services/game-loop.js";
import { send } from "@/sse/manager.js";
import { runSessionArcAgent } from "@/agents/session-arc.js";
import {
  createSession,
  getSessionById,
  updateSessionArcs,
} from "@/db/queries/sessions.js";
import {
  clearStaleIncidents,
  extendIncidentTimers,
} from "@/db/queries/incidents.js";
import {
  resetAllHeroes,
  getHeroBios,
  getSessionHeroIds,
  extendHeroCooldowns,
} from "@/db/queries/heroes.js";

// Track when each session was paused so resume can extend timers
const sessionPausedAt = new Map<string, number>();
// In-memory lock — prevents double arc generation from React StrictMode double-invoking effects
const arcGenerating = new Set<string>();

// POST /api/v1/sessions
export async function createSessionHandler(_req: Request, res: Response) {
  const session = await createSession();
  sendJson(res, 201, { id: session.id, cityHealth: session.cityHealth, score: session.score });
}

// POST /api/v1/sessions/:id/start
export async function startSession(req: Request, res: Response) {
  const session = await getSessionById(req.params.id as string);

  if (!session) {
    sendJson(res, 404, { error: "Session not found" });
    return;
  }

  // Clear any stale incidents from previous play on this session
  await clearStaleIncidents(session.id);

  // Reset all heroes to full availability at the start of each game run
  await resetAllHeroes();

  // Generate narrative arc seeds — skip if already generated or currently generating
  if (!session.arcSeeds && !arcGenerating.has(session.id)) {
    arcGenerating.add(session.id);
    try {
      const heroBios = await getHeroBios();
      const arcResult = await runSessionArcAgent(heroBios);
      console.log(`[session] arc seeds generated — ${arcResult.arcs.map((a) => a.name).join(", ")} — limit: ${arcResult.incidentLimit}`);
      await updateSessionArcs(session.id, arcResult.arcs, arcResult.sessionMood, arcResult.incidentLimit);
    } finally {
      arcGenerating.delete(session.id);
    }
  }

  registerSession(session.id);
  sendJson(res, 200, { started: true });
}

// POST /api/v1/sessions/:id/pause
export function pauseGameSession(req: Request, res: Response) {
  const id = req.params.id as string;
  pauseSession(id);
  sessionPausedAt.set(id, Date.now());
  console.log(`[session] paused — ${id}`);
  sendJson(res, 200, { paused: true });
}

// POST /api/v1/sessions/:id/resume
export async function resumeGameSession(req: Request, res: Response) {
  const id = req.params.id as string;
  resumeSession(id);

  const pausedAt = sessionPausedAt.get(id);
  if (pausedAt) {
    const pausedMs = Date.now() - pausedAt;
    sessionPausedAt.delete(id);
    console.log(`[session] resumed — ${id} (paused for ${(pausedMs / 1000).toFixed(1)}s)`);

    // Extend expiresAt for all pending incidents so they don't expire during pauses
    const extended = await extendIncidentTimers(id, pausedMs);
    for (const inc of extended) {
      send(id, "incident:timer_extended", { incidentId: inc.id, expiresAt: inc.expiresAt });
    }

    // Extend cooldownUntil for resting heroes in this session, then notify frontend
    const sessionHeroIds = await getSessionHeroIds(id);
    if (sessionHeroIds.length > 0) {
      const extendedHeroes = await extendHeroCooldowns(
        sessionHeroIds.map((r) => r.heroId),
        pausedMs,
      );
      for (const hero of extendedHeroes) {
        send(id, "hero:state_update", {
          heroId: hero.id,
          alias: hero.alias,
          availability: hero.availability,
          health: hero.health,
          cooldownUntil: hero.cooldownUntil,
        });
      }
    }
  }

  sendJson(res, 200, { paused: false });
}

// GET /api/v1/sessions/:id
export async function getSession(req: Request, res: Response) {
  const session = await getSessionById(req.params.id as string);

  if (!session) {
    sendJson(res, 404, { error: "Session not found" });
    return;
  }

  sendJson(res, 200, {
    sessionId: session.id,
    cityHealth: session.cityHealth,
    score: session.score,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  });
}
