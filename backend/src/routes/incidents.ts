import { Router } from "express";
import { generateIncident, dispatchHeroes, getActiveIncidents } from "@/handlers/incidents";

export const incidentsRouter = Router();

incidentsRouter.get("/", getActiveIncidents);
incidentsRouter.post("/generate", generateIncident);
incidentsRouter.post("/:id/dispatch", dispatchHeroes);
