import { runHeroReportAgent, type MissionContext } from "../hero-report.js";
import { runReflectionAgent } from "../reflection.js";
import { runEvalAgent } from "../eval.js";
import { getMissionOutcome, getInterruptOutcome, combineStats, type InterruptOption } from "@/services/outcome.js";
import { send, log } from "@/sse/manager.js";
import { waitForChoice } from "@/services/interrupt-gate.js";
import { getSessionById } from "@/db/queries/sessions.js";
import { getIncidentById, setIncidentStatus } from "@/db/queries/incidents.js";
import {
  getHeroesByIds,
  incrementMissionCounters,
} from "@/db/queries/heroes.js";
import {
  createMission,
  createMissionHeroes,
  storeMissionRoll,
  completeMission,
  storeMissionEval,
  saveMissionHeroReport,
} from "@/db/queries/missions.js";
import type { RequiredStats } from "@/types";

const TRAVEL_TIME_MS = 12_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runMissionPipeline(incidentId: string, heroIds: string[]): Promise<void> {
  console.log(`[mission-pipeline] starting — incident:${incidentId} heroes:${heroIds.join(", ")}`);

  const [incident, dispatchedHeroes] = await Promise.all([
    getIncidentById(incidentId),
    getHeroesByIds(heroIds),
  ]);

  if (!incident) throw new Error(`Incident ${incidentId} not found`);

  const sessionId = incident.sessionId;
  const mission = await createMission(incidentId);
  await createMissionHeroes(mission.id, heroIds);

  console.log(`[mission-pipeline] mission created: ${mission.id}`);
  log(sessionId, `${dispatchedHeroes.map((h) => h.alias).join(" + ")} en route to: ${incident.title}`);

  // Travel to incident
  await sleep(TRAVEL_TIME_MS);
  await setIncidentStatus(incidentId, "active");
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
    await storeMissionRoll(mission.id, result.roll, result.dispatchedStats);
  }
  console.log(`[mission-pipeline] outcome: ${outcome}`);

  await Promise.all([
    setIncidentStatus(incidentId, "debriefing"),
    incrementMissionCounters(heroIds, outcome),
  ]);

  console.log(`[mission-pipeline] generating reports for: ${dispatchedHeroes.map((h) => h.alias).join(", ")}`);

  // Resolve arc name for this incident if it belongs to an arc
  let arcName: string | undefined;
  if (incident.arcId) {
    const session = await getSessionById(sessionId);
    const arcSeeds = (session?.arcSeeds as { id: string; name: string }[] | null) ?? [];
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
      saveMissionHeroReport(mission.id, dispatchedHeroes[i].id, report),
    ),
  );

  await completeMission(mission.id, outcome);

  console.log(`[mission-pipeline] running eval`);
  const evalResult = await runEvalAgent(incidentId, dispatchedHeroes);
  console.log(`[mission-pipeline] eval: ${evalResult.verdict} ${evalResult.score}/10`);

  await storeMissionEval(
    mission.id,
    Math.round(evalResult.score),
    evalResult.verdict,
    evalResult.explanation,
    evalResult.postOpNote,
  );

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
