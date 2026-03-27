import { Router } from "express";
import { createSession } from "@/handlers/sessions";

export const sessionsRouter = Router();

sessionsRouter.post("/", createSession);
