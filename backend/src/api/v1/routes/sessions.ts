import { Router } from "express";
import { createSession, getSession } from "@/api/v1/handlers/sessions";

export const sessionsRouter = Router();

sessionsRouter.post("/", createSession);
sessionsRouter.get("/:id", getSession);
