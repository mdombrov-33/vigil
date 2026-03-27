import { Request, Response } from "express";
import { db, heroes, incidents } from "@vigil/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import { sendJson } from "@/utils/response";
import {
  runIncidentCreationPipeline,
  runMissionPipeline,
} from "@/agents/pipeline";

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

  sendJson(res, 200, { ok: true });
}
