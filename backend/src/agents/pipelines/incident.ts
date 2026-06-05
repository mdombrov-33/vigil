import { runIncidentGeneratorAgent, type SessionContext, type ArcBeat, type PacingStatus } from "../incident-generator.js";
import { runTriageAgent } from "../triage.js";
import { runNarrativePickAgent } from "../narrative-pick.js";
import { runDispatcherAgent } from "../dispatcher.js";
import { scoreHeroes } from "@/services/outcome.js";
import { send, log } from "@/sse/manager.js";
import { getSessionById } from "@/db/queries/sessions.js";
import { getAllNonDownHeroes } from "@/db/queries/heroes.js";
import {
  getSessionIncidentHistory,
  getArcIncidentHeroReports,
  createIncident,
} from "@/db/queries/incidents.js";
import type { ArcSeed } from "../schemas.js";
import type { RequiredStats } from "@/types";

function computePacingStatus(
  arcSeeds: ArcSeed[],
  arcBeats: Record<string, ArcBeat[]>,
  standaloneCount: number,
  incidentNumber: number,
  incidentLimit: number,
): PacingStatus {
  const slotsRemaining = incidentLimit - incidentNumber; // after this one

  const arcStatus = arcSeeds.map((arc) => {
    const beatsCompleted = arcBeats[arc.id]?.length ?? 0;
    const targetBeats = (arc as any).targetBeats ?? 3;
    const beatsNeeded = Math.max(0, targetBeats - beatsCompleted);
    return { id: arc.id, name: arc.name, beatsCompleted, targetBeats, beatsNeeded };
  });

  const totalBeatsNeeded = arcStatus.reduce((sum, a) => sum + a.beatsNeeded, 0);
  const availableForStandalones = slotsRemaining - totalBeatsNeeded;

  let recommendation: string;

  if (incidentNumber === 1) {
    recommendation = "standalone — opening incident, do not reference arc threads yet";
  } else if (availableForStandalones <= 0) {
    // Every remaining slot must be an arc beat to hit targets
    const mostBehind = [...arcStatus].sort((a, b) => b.beatsNeeded - a.beatsNeeded)[0];
    recommendation = `arc beats only from here — no slots for standalones. Advance ${mostBehind.id} ("${mostBehind.name}") — most behind pace`;
  } else if (availableForStandalones <= 1) {
    const mostBehind = [...arcStatus].sort((a, b) => b.beatsNeeded - a.beatsNeeded)[0];
    recommendation = `limited standalone capacity (${availableForStandalones} slot left). Advance ${mostBehind.id} ("${mostBehind.name}") unless you just ran an arc beat`;
  } else if (standaloneCount === 0 && incidentNumber > 2) {
    recommendation = "standalone — no standalones yet, arcs are dominating the session";
  } else {
    // Check if any single arc is critically behind relative to slots
    const critical = arcStatus.find((a) => a.beatsNeeded > 0 && a.beatsNeeded >= slotsRemaining * 0.6);
    if (critical) {
      recommendation = `advance ${critical.id} ("${critical.name}") — needs ${critical.beatsNeeded} beats in ${slotsRemaining} slots, at risk of not concluding`;
    } else {
      const standaloneRatio = standaloneCount / (incidentNumber - 1);
      if (standaloneRatio < 0.2) {
        recommendation = `standalone or advance an arc — standalone ratio is low (${standaloneCount} of ${incidentNumber - 1} incidents). Either is fine but lean standalone`;
      } else {
        recommendation = `pacing is healthy (${standaloneCount} standalone, arcs on track) — advance an arc or go standalone based on narrative feel`;
      }
    }
  }

  return { slotsRemaining, standaloneCount, arcStatus, recommendation };
}

export async function runIncidentCreationPipeline(sessionId: string): Promise<string> {
  console.log("[incident-pipeline] starting");
  log(sessionId, "Analyzing incoming incident...");

  const [session, allHeroes] = await Promise.all([
    getSessionById(sessionId),
    getAllNonDownHeroes(),
  ]);

  const arcSeeds = (session?.arcSeeds as SessionContext["arcSeeds"]) ?? [];
  const sessionMood = session?.sessionMood ?? null;
  const incidentLimit = session?.incidentLimit ?? 15;
  const incidentNumber = (session?.incidentCount ?? 0) + 1;

  const historyRows = await getSessionIncidentHistory(sessionId);

  const arcIncidentIds = historyRows
    .filter((i) => i.arcId != null)
    .map((i) => i.id);

  const heroReportRows = await getArcIncidentHeroReports(arcIncidentIds);

  // Group hero reports by incidentId
  const reportsByIncident: Record<string, { alias: string; report: string }[]> = {};
  for (const row of heroReportRows) {
    if (!row.incidentId || !row.report) continue;
    if (!reportsByIncident[row.incidentId]) reportsByIncident[row.incidentId] = [];
    reportsByIncident[row.incidentId].push({ alias: row.alias, report: row.report });
  }

  // Build recentIncidents (all, lightweight) and arcBeats (arc incidents, rich)
  const recentIncidents: SessionContext["recentIncidents"] = historyRows.map((i) => ({
    title: i.title,
    outcome: i.status === "expired" ? "expired" : i.missionOutcome ?? null,
    arcId: i.arcId ?? null,
  }));

  const arcBeats: Record<string, ArcBeat[]> = {};
  for (const i of historyRows) {
    if (!i.arcId) continue;
    if (!arcBeats[i.arcId]) arcBeats[i.arcId] = [];
    arcBeats[i.arcId].push({
      title: i.title,
      outcome: i.status === "expired" ? "expired" : i.missionOutcome ?? null,
      evalVerdict: i.evalVerdict ?? null,
      evalPostOpNote: i.evalPostOpNote ?? null,
      heroReports: reportsByIncident[i.id] ?? [],
    });
  }

  const standaloneCount = historyRows.filter((i) => i.arcId == null).length;
  const pacingStatus = computePacingStatus(arcSeeds, arcBeats, standaloneCount, incidentNumber, incidentLimit);

  const sessionCtx: SessionContext = {
    arcSeeds,
    sessionMood,
    recentIncidents,
    arcBeats,
    incidentNumber,
    incidentLimit,
    pacingStatus,
  };

  const { title, description, arcId } = await runIncidentGeneratorAgent(sessionCtx);
  console.log(`[incident-pipeline] generated: "${title}"`);
  log(sessionId, `Incident detected: ${title}`);

  // Resolve linkedHeroAlias from arc seed if this incident belongs to a personal arc
  const matchedArc = arcId ? arcSeeds.find((a) => a.id === arcId) : null;
  const linkedHeroAlias = (matchedArc as any)?.arcType === "personal"
    ? ((matchedArc as any)?.linkedHeroAlias ?? null)
    : null;
  const linkedHero = linkedHeroAlias
    ? allHeroes.find((h) => h.alias.toLowerCase() === linkedHeroAlias.toLowerCase()) ?? null
    : null;

  // Triage always runs. NarrativePickAgent is skipped for personal arcs — linked hero is always topHero.
  const [triage, narrativePick] = await Promise.all([
    runTriageAgent(description),
    linkedHero
      ? Promise.resolve({ heroId: linkedHero.id, reasoning: "personal arc — linked hero" })
      : runNarrativePickAgent(description, allHeroes),
  ]);
  const narrativeHero = allHeroes.find((h) => h.id === narrativePick.heroId);
  console.log(
    `[incident-pipeline] triage done — danger:${triage.dangerLevel} slots:${triage.slotCount} heroes:${allHeroes.length}`,
  );
  console.log(
    `[incident-pipeline] narrative top-1: ${narrativeHero?.alias ?? narrativePick.heroId}${linkedHero ? " (personal arc)" : ` — ${narrativePick.reasoning}`}`,
  );
  log(sessionId, `Triage complete — danger level ${triage.dangerLevel}/3, ${triage.slotCount} slot${triage.slotCount > 1 ? "s" : ""}`);

  const recommended = scoreHeroes(
    allHeroes,
    triage.requiredStats as RequiredStats,
    triage.slotCount,
  );
  console.log(`[incident-pipeline] stat recommended: ${recommended.map((h) => h.alias).join(", ")}`);

  // Enforce 3-minute minimum — pipeline itself takes 20-40s so short AI-set values expire before player sees them
  const MIN_EXPIRY_S = 180;
  const expiresAt = new Date(Date.now() + Math.max(MIN_EXPIRY_S, triage.expiryDuration) * 1000);

  const incident = await createIncident({
    sessionId,
    title,
    description,
    requiredStats: triage.requiredStats,
    slotCount: triage.slotCount,
    dangerLevel: triage.dangerLevel,
    missionDuration: triage.missionDuration,
    expiryDuration: triage.expiryDuration,
    hints: triage.hints,
    hasInterrupt: triage.hasInterrupt,
    interruptTrigger: triage.interruptTrigger ?? null,
    interruptOptions: triage.interruptOptions ?? null,
    topHeroId: narrativePick.heroId,
    arcId: arcId ?? null,
    linkedHeroAlias: linkedHeroAlias ?? null,
    expiresAt,
  });
  console.log(`[incident-pipeline] incident saved: ${incident.id}`);

  await runDispatcherAgent(incident.id, recommended, triage, description);
  console.log(`[incident-pipeline] recommendation stored`);

  send(sessionId, "incident:new", {
    incidentId: incident.id,
    title: incident.title,
    description: incident.description,
    hints: (incident.hints as string[]) ?? [],
    slotCount: incident.slotCount,
    dangerLevel: incident.dangerLevel,
    hasInterrupt: incident.hasInterrupt,
    linkedHeroAlias: incident.linkedHeroAlias ?? null,
    createdAt: incident.createdAt,
    expiresAt: incident.expiresAt,
  });

  console.log(`[incident-pipeline] done — incident ${incident.id} ready`);
  return incident.id;
}
