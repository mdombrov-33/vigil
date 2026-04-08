import { getActiveSessions, send, log } from "@/sse/manager.js";
import { dockCityHealth } from "@/services/city-health.js";
import { runIncidentCreationPipeline } from "@/agents/pipelines/incident.js";
import {
  getExpiredPendingIncidents,
  markIncidentsExpired,
  getActiveIncidentCount,
  getUnresolvedIncidentIds,
} from "@/db/queries/incidents.js";
import {
  getSessionSpawnState,
  incrementIncidentCount,
  endSession,
} from "@/db/queries/sessions.js";

const MAX_ACTIVE_INCIDENTS = 4;
const SPAWN_INTERVAL_MS = 45_000 + Math.random() * 15_000; // used only for initial lastSpawn offset

const lastSpawn = new Map<string, number>();
const pausedSessions = new Set<string>();
const completedSessions = new Set<string>();

export function pauseSession(sessionId: string) { pausedSessions.add(sessionId); }
export function resumeSession(sessionId: string) { pausedSessions.delete(sessionId); }
export function isSessionPaused(sessionId: string) { return pausedSessions.has(sessionId); }
export function getPausedSessionIds(): string[] { return [...pausedSessions]; }

function completeSession(sessionId: string, finalScore: number) {
  completedSessions.add(sessionId);
  lastSpawn.delete(sessionId);
  pausedSessions.delete(sessionId);
  send(sessionId, "session:complete", { finalScore });
  endSession(sessionId).catch(() => {});
  console.log(`[game-loop] session ${sessionId} complete — score: ${finalScore}`);
}

export function registerSession(sessionId: string) {
  if (!lastSpawn.has(sessionId)) {
    // Set to past so first spawn happens on the next tick (~5s) rather than after a full interval
    lastSpawn.set(sessionId, Date.now() - SPAWN_INTERVAL_MS + 10_000);
  }
}

export function startIncidentScheduler() {
  console.log(`[incident-scheduler] started`);
  setInterval(async () => {
    const activeSessions = getActiveSessions();
    if (activeSessions.length === 0) return;
    await Promise.all(activeSessions.map(runLoopTick));
  }, 5_000);
}

async function runLoopTick(sessionId: string) {
  if (pausedSessions.has(sessionId)) return;
  if (completedSessions.has(sessionId)) return;
  await Promise.all([checkExpiry(sessionId), checkSpawn(sessionId)]);
}

async function checkExpiry(sessionId: string) {
  const now = new Date();
  const expired = await getExpiredPendingIncidents(sessionId, now);
  if (expired.length === 0) return;

  await markIncidentsExpired(sessionId, now);

  for (const incident of expired) {
    console.log(`[game-loop] incident expired: ${incident.title}`);
    send(sessionId, "incident:expired", { incidentId: incident.id });
    log(sessionId, `Incident expired unresolved: ${incident.title}`);
    await dockCityHealth(sessionId, 15, `incident expired: ${incident.title}`);
  }
}

async function checkSpawn(sessionId: string) {
  const session = await getSessionSpawnState(sessionId);
  if (!session) return;

  const limit = session.incidentLimit ?? 15;

  // Session limit reached — check if all incidents have cleared (session complete)
  if (session.incidentCount >= limit) {
    const stillActive = await getUnresolvedIncidentIds(sessionId);
    if (stillActive.length === 0) {
      completeSession(sessionId, session.score);
    }
    return;
  }

  // Normal spawn timing check
  const now = Date.now();
  const last = lastSpawn.get(sessionId) ?? 0;
  const spawnInterval = 45_000 + Math.random() * 15_000;
  if (now - last < spawnInterval) return;

  // Don't pile on beyond the active cap
  const activeCount = await getActiveIncidentCount(sessionId);
  if (activeCount >= MAX_ACTIVE_INCIDENTS) {
    console.log(`[game-loop] skipping spawn for ${sessionId} — ${activeCount} active incidents`);
    return;
  }

  // Increment count atomically before spawning
  await incrementIncidentCount(sessionId);
  lastSpawn.set(sessionId, now);
  console.log(`[game-loop] spawning incident ${session.incidentCount + 1}/${limit} for session ${sessionId}`);

  runIncidentCreationPipeline(sessionId).catch((err) =>
    console.error(`[game-loop] spawn error for session ${sessionId}:`, err),
  );
}
