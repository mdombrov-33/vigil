import { db, heroes, incidents, missions, missionHeroes } from "@vigil/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import { runIncidentGeneratorAgent } from "./incident-generator.js";
import { runTriageAgent } from "./triage.js";
import { runDispatcherAgent } from "./dispatcher.js";
import { runHeroReportAgent } from "./hero-report.js";
import { runReflectionAgent } from "./reflection.js";
import { runEvalAgent } from "./eval.js";
import { scoreHeroes, getMissionOutcome } from "@/services/outcome.js";
import {
  getCooldownUntil,
  rollHealthAfterFailure,
} from "@/services/cooldown.js";
import type { RequiredStats } from "@/types";

// ── Incident Creation Pipeline ────────────────────────────────────────────────

export async function runIncidentCreationPipeline(
  sessionId: string,
): Promise<string> {
  console.log("[incident-pipeline] starting");

  const { title, description } = await runIncidentGeneratorAgent();
  console.log(`[incident-pipeline] generated: "${title}"`);

  const [triage, availableHeroes] = await Promise.all([
    runTriageAgent(description),
    db
      .select()
      .from(heroes)
      .where(
        and(eq(heroes.availability, "available"), ne(heroes.health, "down")),
      ),
  ]);
  console.log(
    `[incident-pipeline] triage done — danger:${triage.dangerLevel} slots:${triage.slotCount} available heroes:${availableHeroes.length}`,
  );

  const recommended = scoreHeroes(
    availableHeroes,
    triage.requiredStats as RequiredStats,
    triage.slotCount,
  );
  console.log(
    `[incident-pipeline] recommended: ${recommended.map((h) => h.alias).join(", ")}`,
  );

  const expiresAt = new Date(Date.now() + triage.expiryDuration * 1000);
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
      hasInterrupt: triage.hasInterrupt,
      interruptOptions: triage.interruptOptions ?? null,
      topHeroId: recommended[0]?.id ?? null,
      expiresAt,
    })
    .returning();
  console.log(`[incident-pipeline] incident saved: ${incident.id}`);

  await runDispatcherAgent(incident.id, recommended, triage, description);
  console.log(`[incident-pipeline] recommendation stored`);

  console.log(`[incident-pipeline] done — incident ${incident.id} ready`);
  return incident.id;
}

// ── Mission Pipeline ──────────────────────────────────────────────────────────

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

  const [mission] = await db
    .insert(missions)
    .values({ incidentId })
    .returning();

  await db
    .insert(missionHeroes)
    .values(heroIds.map((heroId) => ({ missionId: mission.id, heroId })));

  console.log(`[mission-pipeline] mission created: ${mission.id}`);

  const outcome = getMissionOutcome(
    dispatchedHeroes,
    incident.requiredStats as RequiredStats,
  );
  console.log(`[mission-pipeline] outcome: ${outcome}`);

  console.log(
    `[mission-pipeline] generating reports for: ${dispatchedHeroes.map((h) => h.alias).join(", ")}`,
  );
  const rawReports = await Promise.all(
    dispatchedHeroes.map((hero) => runHeroReportAgent(hero, outcome, incident)),
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

  const combinedReport = polishedReports.join("\n\n---\n\n");
  await db
    .update(missions)
    .set({ outcome, report: combinedReport, completedAt: new Date() })
    .where(eq(missions.id, mission.id));

  console.log(`[mission-pipeline] updating hero states`);
  await Promise.all(
    dispatchedHeroes.map((hero) => {
      const newHealth =
        outcome === "failure"
          ? rollHealthAfterFailure(hero.health)
          : hero.health;
      const cooldownUntil = getCooldownUntil(newHealth);
      console.log(
        `[mission-pipeline] ${hero.alias} → ${newHealth}, cooldown: ${cooldownUntil?.toISOString() ?? "permanent"}`,
      );
      return db
        .update(heroes)
        .set({ availability: "resting", health: newHealth, cooldownUntil })
        .where(eq(heroes.id, hero.id));
    }),
  );

  console.log(`[mission-pipeline] running eval`);
  await runEvalAgent(incidentId, dispatchedHeroes);

  console.log(`[mission-pipeline] done — mission ${mission.id} complete`);
}
