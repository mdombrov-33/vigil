import { Router } from "express";
import { generateIncident, dispatchHeroes } from "@/handlers/incidents";

export const incidentsRouter = Router();

incidentsRouter.post("/generate", generateIncident);
incidentsRouter.post("/:id/dispatch", dispatchHeroes);
