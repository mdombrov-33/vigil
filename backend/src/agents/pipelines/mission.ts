import { db, heroes, incidents, missions, missionHeroes, sessions } from "@/db/index.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import { runHeroReportAgent, type MissionContext } from "../hero-report.js";
import { runReflectionAgent } from "../reflection.js";
import { runEvalAgent } from "../eval.js";
import { getMissionOutcome, getInterruptOutcome, combineStats, type InterruptOption } from "@/services/outcome.js";
import { send, log } from "@/sse/manager.js";
import { waitForChoice } from "@/services/interrupt-gate.js";
import type { RequiredStats } from "@/types";

const TRAVEL_TIME_MS = 12_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runMissionPipeline(incidentId: string, heroIds: string[]): Promise<void> {
  console.log(`[mission-pipeline] starting — incident:${incidentId} heroes:${heroIds.join(", ")}`);

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
  await db.update(incidents).set({ status: "active" }).where(eq(incidents.id, incidentId));
  send(sessionId, "incident:active", { incidentId });
  log(sessionId, `${dispatchedHeroes.map((h) => h.alias).join(" + ")} on scene`);

  // Mission in progress
  const halfMs = (incident.missionDuration * 1000) / 2;
  let outcome: "success" | "failure";
  let interruptContext: MissionContext["interrupt"] | undefined;

  if (incident.hasInterrupt && incident.interruptOptions) {
    const options = incident.interruptOptions as InterruptOption[];

    await sleep(halfMs);

    send(sessionId, "mission:interrupt", {
      incidentId,
      missionId: mission.id,
      topHeroId: incident.topHeroId,
      heroIds,
      trigger: incident.interruptTrigger ?? null,
      interruptDurationMs: halfMs,
      options: options.map((o) => ({
        id: o.id,
        text: o.text,
        isHeroSpecific: o.isHeroSpecific,
      })),
    });
    log(sessionId, `Interrupt triggered — awaiting player decision`);

    const choiceId = await waitForChoice(mission.id, sessionId, halfMs);

    if (choiceId === null) {
      outcome = "failure";
      log(sessionId, `Interrupt ignored — mission failed`);
    } else {
      const chosen = options.find((o) => o.id === choiceId)!;
      outcome = getInterruptOutcome(chosen, dispatchedHeroes, incident.topHeroId);
      interruptContext = { chosenOptionText: chosen.text, outcome };
      log(sessionId, `Interrupt resolved: "${chosen.text}" → ${outcome.toUpperCase()}`);

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
        options,
      });
    }
  } else {
    await sleep(incident.missionDuration * 1000);
    const result = getMissionOutcome(dispatchedHeroes, incident.requiredStats as RequiredStats);
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

  console.log(`[mission-pipeline] generating reports for: ${dispatchedHeroes.map((h) => h.alias).join(", ")}`);

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
      runReflectionAgent(report.report, dispatchedHeroes[i], outcome, incident.title),
    ),
  );

  await Promise.all(
    polishedReports.map((report, i) =>
      db
        .update(missionHeroes)
        .set({ report })
        .where(and(
          eq(missionHeroes.missionId, mission.id),
          eq(missionHeroes.heroId, dispatchedHeroes[i].id),
        )),
    ),
  );

  await db
    .update(missions)
    .set({ outcome, completedAt: new Date() })
    .where(eq(missions.id, mission.id));

  console.log(`[mission-pipeline] running eval`);
  const evalResult = await runEvalAgent(incidentId, dispatchedHeroes);
  console.log(`[mission-pipeline] eval: ${evalResult.verdict} ${evalResult.score}/10`);

  await db
    .update(missions)
    .set({
      evalScore: Math.round(evalResult.score),
      evalVerdict: evalResult.verdict,
      evalExplanation: evalResult.explanation,
      evalPostOpNote: evalResult.postOpNote,
    })
    .where(eq(missions.id, mission.id));

  // For non-interrupt missions: outcome intentionally omitted — player reveals via ROLL pin.
  // For interrupt missions: outcome included since it was already shown in the interrupt modal.
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
