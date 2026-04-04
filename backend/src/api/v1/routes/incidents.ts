import { Router } from "express";
import { generateIncident, dispatchHeroes, getActiveIncidents, getIncident, getDebrief, submitInterruptChoice, rollMission, acknowledgeDebrief } from "@/api/v1/handlers/incidents";

export const incidentsRouter = Router();

incidentsRouter.get("/", getActiveIncidents);
incidentsRouter.post("/generate", generateIncident);
incidentsRouter.get("/:id", getIncident);
incidentsRouter.get("/:id/debrief", getDebrief);
incidentsRouter.post("/:id/dispatch", dispatchHeroes);
incidentsRouter.post("/:id/interrupt", submitInterruptChoice);
incidentsRouter.post("/:id/roll", rollMission);
incidentsRouter.post("/:id/acknowledge", acknowledgeDebrief);
