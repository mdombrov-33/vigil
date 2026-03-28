import { Request, Response } from "express";
import { db, sessions } from "@vigil/db";
import { eq } from "drizzle-orm";
import { sendJson } from "@/utils/response";

// POST /api/sessions
export async function createSession(_req: Request, res: Response) {
  const [session] = await db.insert(sessions).values({}).returning();
  sendJson(res, 201, { sessionId: session.id });
}

// GET /api/sessions/:id
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
