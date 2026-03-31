import { db, incidents } from "@/db/index.js";
import { and, eq, inArray, lt } from "drizzle-orm";
import { getActiveSessions, send, log } from "@/sse/manager.js";
import { dockCityHealth } from "@/services/city-health.js";
import { runIncidentCreationPipeline } from "@/agents/pipeline.js";

const MAX_ACTIVE_INCIDENTS = 4;
const SPAWN_INTERVAL_MS = 45_000 + Math.random() * 15_000; // 45–60s, randomized once at startup

const lastSpawn = new Map<string, number>();
const pausedSessions = new Set<string>();

export function pauseSession(sessionId: string) { pausedSessions.add(sessionId); }
export function resumeSession(sessionId: string) { pausedSessions.delete(sessionId); }
export function isSessionPaused(sessionId: string) { return pausedSessions.has(sessionId); }

export function registerSession(sessionId: string) {
  if (!lastSpawn.has(sessionId)) {
    // Set to past so first spawn happens on the next tick (~5s) rather than after a full interval
    lastSpawn.set(sessionId, Date.now() - SPAWN_INTERVAL_MS + 10_000);
  }
}

export function startIncidentScheduler() {
  console.log(
    `[incident-scheduler] started — spawn interval: ${Math.round(SPAWN_INTERVAL_MS / 1000)}s`,
  );

  setInterval(async () => {
    const activeSessions = getActiveSessions();
    if (activeSessions.length === 0) return;

    await Promise.all(activeSessions.map(runLoopTick));
  }, 5_000);
}

async function runLoopTick(sessionId: string) {
  if (pausedSessions.has(sessionId)) return;
  await Promise.all([checkExpiry(sessionId), checkSpawn(sessionId)]);
}

async function checkExpiry(sessionId: string) {
  const now = new Date();

  const expired = await db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.sessionId, sessionId),
        eq(incidents.status, "pending"),
        lt(incidents.expiresAt, now),
      ),
    );

  if (expired.length === 0) return;

  await db
    .update(incidents)
    .set({ status: "expired" })
    .where(
      and(
        eq(incidents.sessionId, sessionId),
        eq(incidents.status, "pending"),
        lt(incidents.expiresAt, now),
      ),
    );

  for (const incident of expired) {
    console.log(`[game-loop] incident expired: ${incident.title}`);
    send(sessionId, "incident:expired", { incidentId: incident.id });
    log(sessionId, `Incident expired unresolved: ${incident.title}`);
    await dockCityHealth(sessionId, 15, `incident expired: ${incident.title}`);
  }
}

async function checkSpawn(sessionId: string) {
  const now = Date.now();
  const last = lastSpawn.get(sessionId) ?? 0;

  if (now - last < SPAWN_INTERVAL_MS) return;

  // Check active incident count — don't pile on beyond the cap
  const active = await db
    .select({ id: incidents.id })
    .from(incidents)
    .where(
      and(
        eq(incidents.sessionId, sessionId),
        inArray(incidents.status, ["pending", "en_route", "active"]),
      ),
    );

  if (active.length >= MAX_ACTIVE_INCIDENTS) {
    console.log(
      `[game-loop] skipping spawn for ${sessionId} — ${active.length} active incidents`,
    );
    return;
  }

  lastSpawn.set(sessionId, now);
  console.log(`[game-loop] spawning incident for session ${sessionId}`);

  runIncidentCreationPipeline(sessionId).catch((err) =>
    console.error(`[game-loop] spawn error for session ${sessionId}:`, err),
  );
}
