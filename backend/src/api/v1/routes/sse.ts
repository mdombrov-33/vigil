import { Router, Request, Response } from "express";
import { register } from "@/sse/manager";
import { registerSession } from "@/services/game-loop";

const router = Router();

// GET /api/v1/sse?sessionId=xxx
// Frontend opens this once at session start and keeps it alive.
router.get("/", (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  register(sessionId, res);
  registerSession(sessionId);

  // Keep-alive ping every 30s to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 30_000);

  res.on("close", () => clearInterval(keepAlive));
});

export default router;
