import { db, heroes, incidents, missions, missionHeroes, sessions } from "@/db/index.js";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { runIncidentGeneratorAgent, type SessionContext, type ArcBeat } from "../incident-generator.js";
import { runTriageAgent } from "../triage.js";
import { runNarrativePickAgent } from "../narrative-pick.js";
import { runDispatcherAgent } from "../dispatcher.js";
import { scoreHeroes } from "@/services/outcome.js";
import { send, log } from "@/sse/manager.js";
import type { RequiredStats } from "@/types";

export async function runIncidentCreationPipeline(sessionId: string): Promise<string> {
  console.log("[incident-pipeline] starting");
  log(sessionId, "Analyzing incoming incident...");

  const [sessionRow, availableHeroes, allHeroes] = await Promise.all([
    db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1),
    db.select().from(heroes).where(and(eq(heroes.availability, "available"), ne(heroes.health, "down"))),
    db.select().from(heroes).where(ne(heroes.health, "down")),
  ]);

  const session = sessionRow[0];
  const arcSeeds = (session?.arcSeeds as SessionContext["arcSeeds"]) ?? [];
  const sessionMood = session?.sessionMood ?? null;
  const incidentLimit = session?.incidentLimit ?? 15;
  const incidentNumber = (session?.incidentCount ?? 0) + 1;

  // Fetch full session incident history with mission outcomes
  const historyRows = await db
    .select({
      id: incidents.id,
      title: incidents.title,
      status: incidents.status,
      arcId: incidents.arcId,
      missionOutcome: missions.outcome,
      evalVerdict: missions.evalVerdict,
      evalPostOpNote: missions.evalPostOpNote,
    })
    .from(incidents)
    .leftJoin(missions, eq(missions.incidentId, incidents.id))
    .where(eq(incidents.sessionId, sessionId))
    .orderBy(desc(incidents.createdAt));

  // Fetch hero reports for arc incidents only
  const arcIncidentIds = historyRows
    .filter((i) => i.arcId != null)
    .map((i) => i.id);

  const heroReportRows = arcIncidentIds.length > 0
    ? await db
      .select({
        incidentId: missions.incidentId,
        alias: heroes.alias,
        report: missionHeroes.report,
      })
      .from(missionHeroes)
      .innerJoin(missions, eq(missions.id, missionHeroes.missionId))
      .innerJoin(heroes, eq(heroes.id, missionHeroes.heroId))
      .where(and(
        inArray(missions.incidentId, arcIncidentIds),
        ne(missionHeroes.report, ""),
      ))
    : [];

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

  const sessionCtx: SessionContext = {
    arcSeeds,
    sessionMood,
    recentIncidents,
    arcBeats,
    incidentNumber,
    incidentLimit,
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
    `[incident-pipeline] triage done — danger:${triage.dangerLevel} slots:${triage.slotCount} available heroes:${availableHeroes.length}`,
  );
  console.log(
    `[incident-pipeline] narrative top-1: ${narrativeHero?.alias ?? narrativePick.heroId}${linkedHero ? " (personal arc)" : ` — ${narrativePick.reasoning}`}`,
  );
  log(sessionId, `Triage complete — danger level ${triage.dangerLevel}/3, ${triage.slotCount} slot${triage.slotCount > 1 ? "s" : ""}`);

  const recommended = scoreHeroes(
    availableHeroes,
    triage.requiredStats as RequiredStats,
    triage.slotCount,
  );
  console.log(`[incident-pipeline] stat recommended: ${recommended.map((h) => h.alias).join(", ")}`);

  // Enforce 3-minute minimum — pipeline itself takes 20-40s so short AI-set values expire before player sees them
  const MIN_EXPIRY_S = 180;
  const expiresAt = new Date(Date.now() + Math.max(MIN_EXPIRY_S, triage.expiryDuration) * 1000);
  const [incident] = await db
    .insert(incidents)
    .values({
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
    })
    .returning();
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
