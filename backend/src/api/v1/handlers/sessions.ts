import { Request, Response } from "express";
import { db, sessions, heroes, incidents } from "@/db/index.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import { sendJson } from "@/utils/response";
import { registerSession, pauseSession, resumeSession } from "@/services/game-loop.js";
import { send } from "@/sse/manager.js";
import { runSessionArcAgent } from "@/agents/session-arc.js";

// Track when each session was paused so resume can extend timers
const sessionPausedAt = new Map<string, number>();
// In-memory lock — prevents double arc generation from React StrictMode double-invoking effects
const arcGenerating = new Set<string>();

// POST /api/v1/sessions
export async function createSession(_req: Request, res: Response) {
  const [session] = await db.insert(sessions).values({}).returning();
  sendJson(res, 201, { id: session.id, cityHealth: session.cityHealth, score: session.score });
}

// POST /api/v1/sessions/:id/start
// Registers the session with the game loop — call this when player clicks "Start Shift".
export async function startSession(req: Request, res: Response) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, req.params.id as string))
    .limit(1);

  if (!session) {
    sendJson(res, 404, { error: "Session not found" });
    return;
  }

  // Clear any stale incidents from previous play on this session
  await db
    .update(incidents)
    .set({ status: "expired" })
    .where(
      and(
        eq(incidents.sessionId, session.id),
        inArray(incidents.status, ["pending", "en_route", "active", "debriefing"])
      )
    );

  // Reset all heroes to full availability at the start of each game run
  await db.update(heroes).set({
    availability: "available",
    health: "healthy",
    cooldownUntil: null,
    missionsCompleted: 0,
    missionsFailed: 0,
  });

  // Generate narrative arc seeds — skip if already generated or currently generating
  if (!session.arcSeeds && !arcGenerating.has(session.id)) {
    arcGenerating.add(session.id);
    try {
      const allHeroes = await db.select({ alias: heroes.alias, bio: heroes.bio }).from(heroes);
      const arcResult = await runSessionArcAgent(allHeroes);
      console.log(`[session] arc seeds generated — ${arcResult.arcs.map((a) => a.name).join(", ")} — limit: ${arcResult.incidentLimit}`);

      await db.update(sessions).set({
        arcSeeds: arcResult.arcs,
        sessionMood: arcResult.sessionMood,
        incidentLimit: arcResult.incidentLimit,
        incidentCount: 0,
      }).where(eq(sessions.id, session.id));
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

    // Extend expiresAt for all pending incidents so they don't expire during pauses
    const extended = await db
      .update(incidents)
      .set({ expiresAt: sql`${incidents.expiresAt} + make_interval(secs => ${pausedMs / 1000})` })
      .where(and(eq(incidents.sessionId, id), eq(incidents.status, "pending")))
      .returning({ id: incidents.id, expiresAt: incidents.expiresAt });

    // Notify frontend of updated expiry times so rings stay in sync
    for (const inc of extended) {
      send(id, "incident:timer_extended", { incidentId: inc.id, expiresAt: inc.expiresAt });
    }
  }

  sendJson(res, 200, { paused: false });
}

// GET /api/v1/sessions/:id
export async function getSession(req: Request, res: Response) {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, req.params.id as string))
    .limit(1);

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
