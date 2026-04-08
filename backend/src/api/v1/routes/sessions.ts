import { Router } from "express";
import { createSessionHandler, getSession, startSession, pauseGameSession, resumeGameSession } from "@/api/v1/handlers/sessions";

export const sessionsRouter = Router();

sessionsRouter.post("/", createSessionHandler);
sessionsRouter.get("/:id", getSession);
sessionsRouter.post("/:id/start", startSession);
sessionsRouter.post("/:id/pause", pauseGameSession);
sessionsRouter.post("/:id/resume", resumeGameSession);
