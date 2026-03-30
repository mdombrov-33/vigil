import { Request, Response } from "express";
import { db, sessions, heroes, incidents } from "@/db/index.js";
import { and, eq, inArray } from "drizzle-orm";
import { sendJson } from "@/utils/response";
import { registerSession, pauseSession, resumeSession } from "@/services/game-loop.js";

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

  registerSession(session.id);
  sendJson(res, 200, { started: true });
}

// POST /api/v1/sessions/:id/pause
export function pauseGameSession(req: Request, res: Response) {
  pauseSession(req.params.id as string);
  sendJson(res, 200, { paused: true });
}

// POST /api/v1/sessions/:id/resume
export function resumeGameSession(req: Request, res: Response) {
  resumeSession(req.params.id as string);
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
