import { Router } from "express";
import { generateIncident, dispatchHeroes, getActiveIncidents, getIncident, submitInterruptChoice } from "@/handlers/incidents";

export const incidentsRouter = Router();

incidentsRouter.get("/", getActiveIncidents);
incidentsRouter.post("/generate", generateIncident);
incidentsRouter.get("/:id", getIncident);
incidentsRouter.post("/:id/dispatch", dispatchHeroes);
incidentsRouter.post("/:id/interrupt", submitInterruptChoice);
