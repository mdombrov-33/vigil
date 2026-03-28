import { Router } from "express";
import { createSession, getSession } from "@/handlers/sessions";

export const sessionsRouter = Router();

sessionsRouter.post("/", createSession);
sessionsRouter.get("/:id", getSession);
