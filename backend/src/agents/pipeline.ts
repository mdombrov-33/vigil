import { db, heroes, incidents, missions, missionHeroes, sessions } from "@/db/index.js";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { runIncidentGeneratorAgent, type SessionContext, type ArcBeat } from "./incident-generator.js";
import { runTriageAgent } from "./triage.js";
import { runNarrativePickAgent } from "./narrative-pick.js";
import { runDispatcherAgent } from "./dispatcher.js";
import { runHeroReportAgent, type MissionContext } from "./hero-report.js";
import { runReflectionAgent } from "./reflection.js";
import { runEvalAgent } from "./eval.js";
import { scoreHeroes, getMissionOutcome, getInterruptOutcome, combineStats, type InterruptOption } from "@/services/outcome.js";
import { send, log } from "@/sse/manager.js";
import { waitForChoice } from "@/services/interrupt-gate.js";
import type { RequiredStats } from "@/types";

const TRAVEL_TIME_MS = 12_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Incident Creation Pipeline
export async function runIncidentCreationPipeline(
  sessionId: string,
): Promise<string> {
  console.log("[incident-pipeline] starting");
  log(sessionId, "Analyzing incoming incident...");

  // Fetch session context + heroes in parallel
  const [sessionRow, availableHeroes] = await Promise.all([
    db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1),
    db.select().from(heroes).where(and(eq(heroes.availability, "available"), ne(heroes.health, "down"))),
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
    outcome: i.status === "expired"
      ? "expired"
      : i.missionOutcome ?? null,
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

  // Generate incident flavor with session context
  const { title, description, arcId } = await runIncidentGeneratorAgent(sessionCtx);
  console.log(`[incident-pipeline] generated: "${title}"`);
  log(sessionId, `Incident detected: ${title}`);

  // Resolve linkedHeroAlias from arc seed if this incident belongs to a personal arc
  const matchedArc = arcId ? arcSeeds.find((a) => a.id === arcId) : null;
  const linkedHeroAlias = (matchedArc as any)?.arcType === "personal"
    ? ((matchedArc as any)?.linkedHeroAlias ?? null)
    : null;
  const linkedHero = linkedHeroAlias
    ? availableHeroes.find((h) => h.alias.toLowerCase() === linkedHeroAlias.toLowerCase()) ?? null
    : null;

  // Triage always runs. NarrativePickAgent is skipped for personal arcs — linked hero is always topHero.
  const [triage, narrativePick] = await Promise.all([
    runTriageAgent(description),
    linkedHero ? Promise.resolve({ heroId: linkedHero.id, reasoning: "personal arc — linked hero" }) : runNarrativePickAgent(description, availableHeroes),
  ]);
  const narrativeHero = availableHeroes.find((h) => h.id === narrativePick.heroId);
  console.log(
    `[incident-pipeline] triage done — danger:${triage.dangerLevel} slots:${triage.slotCount} available heroes:${availableHeroes.length}`,
  );
  console.log(
    `[incident-pipeline] narrative top-1: ${narrativeHero?.alias ?? narrativePick.heroId}${linkedHero ? " (personal arc)" : ` — ${narrativePick.reasoning}`}`,
  );
  log(
    sessionId,
    `Triage complete — danger level ${triage.dangerLevel}/3, ${triage.slotCount} slot${triage.slotCount > 1 ? "s" : ""}`,
  );

  const recommended = scoreHeroes(
    availableHeroes,
    triage.requiredStats as RequiredStats,
    triage.slotCount,
  );
  console.log(
    `[incident-pipeline] stat recommended: ${recommended.map((h) => h.alias).join(", ")}`,
  );

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

  // Incident is fully analyzed — push pin to map
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

// Mission Pipeline

export async function runMissionPipeline(
  incidentId: string,
  heroIds: string[],
): Promise<void> {
  console.log(
    `[mission-pipeline] starting — incident:${incidentId} heroes:${heroIds.join(", ")}`,
  );

  const [incidentRows, dispatchedHeroes] = await Promise.all([
    db.select().from(incidents).where(eq(incidents.id, incidentId)).limit(1),
    db.select().from(heroes).where(inArray(heroes.id, heroIds)),
  ]);

  const incident = incidentRows[0];
  if (!incident) throw new Error(`Incident ${incidentId} not found`);

  const sessionId = incident.sessionId;

  const [mission] = await db
    .insert(missions)
    .values({ incidentId })
    .returning();

  await db
    .insert(missionHeroes)
    .values(heroIds.map((heroId) => ({ missionId: mission.id, heroId })));

  console.log(`[mission-pipeline] mission created: ${mission.id}`);
  log(sessionId, `${dispatchedHeroes.map((h) => h.alias).join(" + ")} en route to: ${incident.title}`);

  // Travel to incident
  await sleep(TRAVEL_TIME_MS);
  await db
    .update(incidents)
    .set({ status: "active" })
    .where(eq(incidents.id, incidentId));
  send(sessionId, "incident:active", { incidentId });
  log(sessionId, `${dispatchedHeroes.map((h) => h.alias).join(" + ")} on scene`);

  // Mission in progress
  const halfMs = (incident.missionDuration * 1000) / 2;
  let outcome: "success" | "failure";
  let interruptContext: MissionContext["interrupt"] | undefined;

  if (incident.hasInterrupt && incident.interruptOptions) {
    const options = incident.interruptOptions as InterruptOption[];

    // Wait first half, then surface the interrupt
    await sleep(halfMs);

    send(sessionId, "mission:interrupt", {
      incidentId,
      missionId: mission.id,
      topHeroId: incident.topHeroId,
      heroIds,
      trigger: incident.interruptTrigger ?? null,
      options: options.map((o) => ({
        id: o.id,
        text: o.text,
        isHeroSpecific: o.isHeroSpecific,
      })),
    });
    log(sessionId, `Interrupt triggered — awaiting player decision`);

    // Wait for player choice — timeout after the remaining half
    const choiceId = await waitForChoice(mission.id, sessionId, halfMs);

    if (choiceId === null) {
      // Player ignored the interrupt — auto-fail
      outcome = "failure";
      log(sessionId, `Interrupt ignored — mission failed`);
    } else {
      const chosen = options.find((o) => o.id === choiceId)!;
      outcome = getInterruptOutcome(chosen, dispatchedHeroes, incident.topHeroId);
      interruptContext = { chosenOptionText: chosen.text, outcome };
      log(sessionId, `Interrupt resolved: "${chosen.text}" → ${outcome.toUpperCase()}`);

      // Reveal full options with stat info now that player has chosen
      const combinedStats = combineStats(dispatchedHeroes);
      const combinedValue = chosen.isHeroSpecific
        ? null
        : (combinedStats[chosen.requiredStat as keyof typeof combinedStats] ?? null);

      send(sessionId, "mission:interrupt:resolved", {
        incidentId,
        missionId: mission.id,
        chosenOptionId: choiceId,
        outcome,
        combinedValue,
        options, // full options including requiredStat/requiredValue
      });
    }
  } else {
    await sleep(incident.missionDuration * 1000);
    const result = getMissionOutcome(
      dispatchedHeroes,
      incident.requiredStats as RequiredStats,
    );
    outcome = result.outcome;
    // Store roll + dispatchedStats in DB — revealed to player when they click the ROLL pin
    await db
      .update(missions)
      .set({ roll: result.roll, dispatchedStats: result.dispatchedStats })
      .where(eq(missions.id, mission.id));
  }
  console.log(`[mission-pipeline] outcome: ${outcome}`);

  await Promise.all([
    db.update(incidents).set({ status: "debriefing" }).where(eq(incidents.id, incidentId)),
    db.update(heroes)
      .set({
        missionsCompleted: outcome === "success"
          ? sql`${heroes.missionsCompleted} + 1`
          : heroes.missionsCompleted,
        missionsFailed: outcome === "failure"
          ? sql`${heroes.missionsFailed} + 1`
          : heroes.missionsFailed,
      })
      .where(inArray(heroes.id, heroIds)),
  ]);

  console.log(
    `[mission-pipeline] generating reports for: ${dispatchedHeroes.map((h) => h.alias).join(", ")}`,
  );
  // Resolve arc name for this incident if it belongs to an arc
  let arcName: string | undefined;
  if (incident.arcId) {
    const sessionArcRow = await db.select({ arcSeeds: sessions.arcSeeds }).from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    const arcSeeds = (sessionArcRow[0]?.arcSeeds as { id: string; name: string }[] | null) ?? [];
    arcName = arcSeeds.find((a) => a.id === incident.arcId)?.name;
  }

  const rawReports = await Promise.all(
    dispatchedHeroes.map((hero) => {
      const missionContext: MissionContext = {
        teammates: dispatchedHeroes.filter((h) => h.id !== hero.id).map((h) => h.alias),
        isLead: hero.id === incident.topHeroId,
        arcName,
        interrupt: interruptContext,
      };
      return runHeroReportAgent(hero, outcome, incident, missionContext);
    }),
  );

  console.log(`[mission-pipeline] running reflection pass`);
  const polishedReports = await Promise.all(
    rawReports.map((report, i) =>
      runReflectionAgent(
        report.report,
        dispatchedHeroes[i],
        outcome,
        incident.title,
      ),
    ),
  );

  // Save per-hero reports on the junction table
  await Promise.all(
    polishedReports.map((report, i) =>
      db
        .update(missionHeroes)
        .set({ report })
        .where(
          and(
            eq(missionHeroes.missionId, mission.id),
            eq(missionHeroes.heroId, dispatchedHeroes[i].id),
          ),
        ),
    ),
  );

  await db
    .update(missions)
    .set({ outcome, completedAt: new Date() })
    .where(eq(missions.id, mission.id));

  console.log(`[mission-pipeline] running eval`);
  const evalResult = await runEvalAgent(incidentId, dispatchedHeroes);
  console.log(
    `[mission-pipeline] eval: ${evalResult.verdict} ${evalResult.score}/10`,
  );

  await db
    .update(missions)
    .set({
      evalScore: Math.round(evalResult.score),
      evalVerdict: evalResult.verdict,
      evalExplanation: evalResult.explanation,
      evalPostOpNote: evalResult.postOpNote,
    })
    .where(eq(missions.id, mission.id));

  // Push completed mission to frontend.
  // For non-interrupt missions: outcome is intentionally omitted — player reveals it
  // by clicking the ROLL pin, which calls POST /incidents/:id/roll.
  // For interrupt missions: outcome is included since it was already shown in the interrupt modal.
  // Score/health and hero resting are applied only when the player acknowledges the debrief,
  // so no consequences fire here that could spoil the roll reveal.
  send(sessionId, "mission:outcome", {
    incidentId,
    missionId: mission.id,
    title: incident.title,
    heroes: dispatchedHeroes.map((h) => ({ heroId: h.id, alias: h.alias })),
    evalScore: Math.round(evalResult.score),
    evalVerdict: evalResult.verdict,
    evalPostOpNote: evalResult.postOpNote,
    hasInterrupt: incident.hasInterrupt,
    ...(incident.hasInterrupt && { outcome }),
  });

  console.log(`[mission-pipeline] done — mission ${mission.id} complete`);
}
