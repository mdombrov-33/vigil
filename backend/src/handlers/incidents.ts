import { Request, Response } from "express";
import { db, heroes, incidents, missions } from "@vigil/db";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { sendJson } from "@/utils/response";
import {
  runIncidentCreationPipeline,
  runMissionPipeline,
} from "@/agents/pipeline";
import { resolveChoice } from "@/services/interrupt-gate";
import type { InterruptOption } from "@/services/outcome";

// GET /api/incidents?sessionId=xxx
// Returns active incidents for the map — pending, en_route, active only.
export async function getActiveIncidents(req: Request, res: Response) {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    sendJson(res, 400, { error: "sessionId is required" });
    return;
  }

  const rows = await db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.sessionId, sessionId),
        inArray(incidents.status, ["pending", "en_route", "active"]),
      ),
    );

  // Only send what the frontend needs — keep required_stats hidden
  const mapped = rows.map((i) => ({
    incidentId: i.id,
    title: i.title,
    description: i.description,
    slotCount: i.slotCount,
    dangerLevel: i.dangerLevel,
    hasInterrupt: i.hasInterrupt,
    status: i.status,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }));

  sendJson(res, 200, mapped);
}

// GET /api/incidents/:id
export async function getIncident(req: Request, res: Response) {
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, req.params.id as string))
    .limit(1);

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
    interruptOptions: incident.status === "active" && incident.hasInterrupt
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

// POST /api/incidents/generate
// Runs the full incident creation pipeline — generator + triage + dispatcher.
// Awaited before returning so the pin appears analysis-complete.
export async function generateIncident(req: Request, res: Response) {
  const { sessionId } = req.body;
  if (!sessionId) {
    sendJson(res, 400, { error: "sessionId is required" });
    return;
  }

  const incidentId = await runIncidentCreationPipeline(sessionId);
  sendJson(res, 201, { incidentId });
}

// POST /api/incidents/:id/dispatch
// Player dispatches heroes. Heroes lock immediately, pipeline runs in background.
export async function dispatchHeroes(req: Request, res: Response) {
  const incidentId = req.params.id as string;
  const { heroIds } = req.body as { heroIds: string[] };

  if (!Array.isArray(heroIds) || heroIds.length === 0) {
    sendJson(res, 400, { error: "heroIds must be a non-empty array" });
    return;
  }

  // Validate incident exists and is still pending
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);

  if (!incident) {
    sendJson(res, 404, { error: "Incident not found" });
    return;
  }
  if (incident.status !== "pending") {
    sendJson(res, 409, { error: `Incident is already ${incident.status}` });
    return;
  }
  if (heroIds.length > incident.slotCount) {
    sendJson(res, 400, {
      error: `Too many heroes — incident has ${incident.slotCount} slots`,
    });
    return;
  }

  // Validate all heroes are available
  const dispatchedHeroes = await db
    .select()
    .from(heroes)
    .where(
      and(
        inArray(heroes.id, heroIds),
        eq(heroes.availability, "available"),
        ne(heroes.health, "down"),
      ),
    );

  if (dispatchedHeroes.length !== heroIds.length) {
    sendJson(res, 409, {
      error: "One or more heroes are unavailable",
    });
    return;
  }

  // Lock heroes and update incident status immediately
  await Promise.all([
    db
      .update(heroes)
      .set({ availability: "on_mission" })
      .where(inArray(heroes.id, heroIds)),
    db
      .update(incidents)
      .set({ status: "en_route" })
      .where(eq(incidents.id, incidentId)),
  ]);

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

// POST /api/incidents/:id/interrupt
// Player submits their interrupt choice.
export async function submitInterruptChoice(req: Request, res: Response) {
  const incidentId = req.params.id as string;
  const { choiceId } = req.body as { choiceId: string };

  if (!choiceId) {
    sendJson(res, 400, { error: "choiceId is required" });
    return;
  }

  // Fetch incident to validate the choice
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);

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
    const [mission] = await db
      .select()
      .from(missions)
      .where(and(eq(missions.incidentId, incidentId), isNull(missions.completedAt)))
      .limit(1);

    if (mission) {
      const heroRows = await db
        .select({ heroId: missions.incidentId })
        .from(missions)
        .where(eq(missions.id, mission.id));

      const topHeroDispatched = heroRows.some(() => incident.topHeroId);

      if (!topHeroDispatched) {
        sendJson(res, 400, { error: "Top hero was not dispatched — this option is unavailable" });
        return;
      }
    }
  }

  // Find the active mission to resolve the gate
  const [activeMission] = await db
    .select()
    .from(missions)
    .where(and(eq(missions.incidentId, incidentId), isNull(missions.completedAt)))
    .limit(1);

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
