import { Request, Response } from "express";
import { db, sessions } from "@vigil/db";
import { sendJson } from "@/utils/response";

// POST /api/sessions
// Creates a new game session. Called when the player hits "Start".
export async function createSession(_req: Request, res: Response) {
  const [session] = await db.insert(sessions).values({}).returning();
  sendJson(res, 201, { sessionId: session.id });
}
