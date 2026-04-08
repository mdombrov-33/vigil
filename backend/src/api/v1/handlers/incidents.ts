import { Request, Response } from "express";
import { sendJson } from "@/utils/response";
import { runIncidentCreationPipeline } from "@/agents/pipelines/incident.js";
import { runMissionPipeline } from "@/agents/pipelines/mission.js";
import { resolveChoice } from "@/services/interrupt-gate";
import { send } from "@/sse/manager.js";
import { dockCityHealth, addScore } from "@/services/city-health.js";
import { getCooldownUntil, rollHealthAfterFailure } from "@/services/cooldown.js";
import type { InterruptOption } from "@/services/outcome";
import {
  getActiveSessionIncidents,
  getIncidentById,
  setIncidentStatus,
} from "@/db/queries/incidents.js";
import {
  getAvailableHeroesByIds,
  setHeroesOnMission,
  setHeroResting,
} from "@/db/queries/heroes.js";
import {
  getActiveMission,
  getCompletedMission,
  getMissionHeroReports,
  getMissionDispatchedHeroes,
} from "@/db/queries/missions.js";

// GET /api/v1/incidents?sessionId=xxx
export async function getActiveIncidents(req: Request, res: Response) {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    sendJson(res, 400, { error: "sessionId is required" });
    return;
  }

  const rows = await getActiveSessionIncidents(sessionId);

  const mapped = rows.map((i) => ({
    incidentId: i.id,
    title: i.title,
    description: i.description,
    slotCount: i.slotCount,
    dangerLevel: i.dangerLevel,
    hasInterrupt: i.hasInterrupt,
    status: i.status,
    requiredStats: i.requiredStats,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }));

  sendJson(res, 200, mapped);
}

// GET /api/v1/incidents/:id
export async function getIncident(req: Request, res: Response) {
  const incident = await getIncidentById(req.params.id as string);

  if (!incident) {
    sendJson(res, 404, { error: "Incident not found" });
    return;
  }

  sendJson(res, 200, {
    incidentId: incident.id,
    title: incident.title,
    description: incident.description,
    slotCount: incident.slotCount,
    dangerLevel: incident.dangerLevel,
    hasInterrupt: incident.hasInterrupt,
    interruptOptions:
      incident.status === "active" && incident.hasInterrupt
        ? (incident.interruptOptions as InterruptOption[])?.map((o) => ({
            id: o.id,
            text: o.text,
            isHeroSpecific: o.isHeroSpecific,
          }))
        : null,
    status: incident.status,
    expiresAt: incident.expiresAt,
    createdAt: incident.createdAt,
  });
}

// POST /api/v1/incidents/generate
export async function generateIncident(req: Request, res: Response) {
  const { sessionId } = req.body;
  if (!sessionId) {
    sendJson(res, 400, { error: "sessionId is required" });
    return;
  }

  const incidentId = await runIncidentCreationPipeline(sessionId);
  sendJson(res, 201, { incidentId });
}

// POST /api/v1/incidents/:id/dispatch
export async function dispatchHeroes(req: Request, res: Response) {
  const incidentId = req.params.id as string;
  const { heroIds } = req.body as { heroIds: string[] };

  if (!Array.isArray(heroIds) || heroIds.length === 0) {
    sendJson(res, 400, { error: "heroIds must be a non-empty array" });
    return;
  }

  const incident = await getIncidentById(incidentId);

  if (!incident) {
    sendJson(res, 404, { error: "Incident not found" });
    return;
  }
  if (incident.status !== "pending") {
    sendJson(res, 409, { error: `Incident is already ${incident.status}` });
    return;
  }
  if (heroIds.length > incident.slotCount) {
    sendJson(res, 400, { error: `Too many heroes — incident has ${incident.slotCount} slots` });
    return;
  }

  // Validate all heroes are available
  const dispatchedHeroes = await getAvailableHeroesByIds(heroIds);

  if (dispatchedHeroes.length !== heroIds.length) {
    sendJson(res, 409, { error: "One or more heroes are unavailable" });
    return;
  }

  // Lock heroes and update incident status immediately
  await Promise.all([
    setHeroesOnMission(heroIds),
    setIncidentStatus(incidentId, "en_route"),
  ]);

  const sessionId = incident.sessionId;
  for (const hero of dispatchedHeroes) {
    send(sessionId, "hero:state_update", {
      heroId: hero.id,
      alias: hero.alias,
      availability: "on_mission",
      health: hero.health,
      cooldownUntil: hero.cooldownUntil?.toISOString() ?? null,
    });
  }

  // Fire pipeline in background — client gets response immediately
  runMissionPipeline(incidentId, heroIds).catch((err) =>
    console.error(`[mission-pipeline] error for incident ${incidentId}:`, err),
  );

  sendJson(res, 200, {
    incidentId,
    status: "en_route",
    heroes: dispatchedHeroes.map((h) => ({ id: h.id, alias: h.alias })),
  });
}

// POST /api/v1/incidents/:id/interrupt
export async function submitInterruptChoice(req: Request, res: Response) {
  const incidentId = req.params.id as string;
  const { choiceId } = req.body as { choiceId: string };

  if (!choiceId) {
    sendJson(res, 400, { error: "choiceId is required" });
    return;
  }

  const incident = await getIncidentById(incidentId);

  if (!incident) {
    sendJson(res, 404, { error: "Incident not found" });
    return;
  }
  if (incident.status !== "active") {
    sendJson(res, 409, { error: "Incident is not in an active interrupt state" });
    return;
  }

  const options = (incident.interruptOptions ?? []) as InterruptOption[];
  const chosen = options.find((o) => o.id === choiceId);

  if (!chosen) {
    sendJson(res, 400, { error: "Invalid choiceId" });
    return;
  }

  // Reject if player tries to submit hero-specific option without the top hero
  if (chosen.isHeroSpecific) {
    const activeMission = await getActiveMission(incidentId);
    if (activeMission) {
      const topHeroDispatched = incident.topHeroId != null;
      if (!topHeroDispatched) {
        sendJson(res, 400, { error: "Top hero was not dispatched — this option is unavailable" });
        return;
      }
    }
  }

  const activeMission = await getActiveMission(incidentId);

  if (!activeMission) {
    sendJson(res, 404, { error: "No active mission found for this incident" });
    return;
  }

  const resolved = resolveChoice(activeMission.id, choiceId);
  if (!resolved) {
    sendJson(res, 409, { error: "No pending interrupt for this mission" });
    return;
  }

  sendJson(res, 200, { ok: true, choiceId });
}

// GET /api/v1/incidents/:id/debrief
export async function getDebrief(req: Request, res: Response) {
  const incidentId = req.params.id as string;

  const incident = await getIncidentById(incidentId);

  if (!incident) {
    sendJson(res, 404, { error: "Incident not found" });
    return;
  }

  const mission = await getCompletedMission(incidentId);

  if (!mission) {
    sendJson(res, 404, { error: "No completed mission found" });
    return;
  }

  const heroRows = await getMissionHeroReports(mission.id);

  sendJson(res, 200, {
    incidentId: incident.id,
    title: incident.title,
    outcome: mission.outcome,
    evalScore: mission.evalScore,
    evalVerdict: mission.evalVerdict,
    evalPostOpNote: mission.evalPostOpNote,
    heroes: heroRows,
  });
}

// POST /api/v1/incidents/:id/roll
export async function rollMission(req: Request, res: Response) {
  const incidentId = req.params.id as string;

  const incident = await getIncidentById(incidentId);

  if (!incident) {
    sendJson(res, 404, { error: "Incident not found" });
    return;
  }
  if (incident.status !== "debriefing") {
    sendJson(res, 409, { error: "Incident is not in debriefing state" });
    return;
  }
  if (incident.hasInterrupt) {
    sendJson(res, 400, { error: "Interrupt missions do not use the roll endpoint" });
    return;
  }

  const mission = await getCompletedMission(incidentId);

  if (!mission) {
    sendJson(res, 404, { error: "No completed mission found" });
    return;
  }

  sendJson(res, 200, {
    outcome: mission.outcome,
    roll: mission.roll,
    requiredStats: incident.requiredStats as Record<string, number>,
    dispatchedStats: mission.dispatchedStats as Record<string, number> | null,
  });
}

// POST /api/v1/incidents/:id/acknowledge
export async function acknowledgeDebrief(req: Request, res: Response) {
  const incidentId = req.params.id as string;

  const incident = await getIncidentById(incidentId);

  if (!incident) {
    sendJson(res, 404, { error: "Incident not found" });
    return;
  }
  if (incident.status !== "debriefing") {
    sendJson(res, 409, { error: "Incident is not awaiting debrief acknowledgement" });
    return;
  }

  const mission = await getCompletedMission(incidentId);

  if (!mission || !mission.outcome) {
    await setIncidentStatus(incidentId, "completed");
    sendJson(res, 200, { ok: true });
    return;
  }

  const sessionId = incident.sessionId;
  const outcome = mission.outcome;
  const dispatchedHeroes = await getMissionDispatchedHeroes(mission.id);

  await setIncidentStatus(incidentId, "completed");

  // Apply score/health consequences
  if (outcome === "failure") {
    await dockCityHealth(sessionId, 10, `mission failed: ${incident.title}`);
  } else if (outcome === "success" && mission.evalVerdict) {
    await addScore(sessionId, mission.evalVerdict);
  }

  // Transition heroes to resting — happens now, after player has seen the outcome
  await Promise.all(
    dispatchedHeroes.map(async (hero) => {
      const newHealth = outcome === "failure" ? rollHealthAfterFailure(hero.health) : hero.health;
      const cooldownUntil = getCooldownUntil(newHealth);

      await setHeroResting(hero.id, newHealth, cooldownUntil);

      send(sessionId, "hero:state_update", {
        heroId: hero.id,
        alias: hero.alias,
        availability: "resting",
        health: newHealth,
        cooldownUntil: cooldownUntil?.toISOString() ?? null,
      });
    }),
  );

  sendJson(res, 200, { ok: true });
}
