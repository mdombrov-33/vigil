import { Response } from "express";

// One SSE connection per session
const connections = new Map<string, Response>();

export function register(sessionId: string, res: Response) {
  connections.set(sessionId, res);
  console.log(`[sse] session ${sessionId} connected (${connections.size} total)`);
  res.on("close", () => {
    connections.delete(sessionId);
    console.log(`[sse] session ${sessionId} disconnected`);
  });
}

// Send to one session
export function send(sessionId: string, event: string, data: unknown) {
  const res = connections.get(sessionId);
  if (!res) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Send to all active sessions (for global state like hero cooldowns)
export function broadcast(event: string, data: unknown) {
  for (const res of connections.values()) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export function log(sessionId: string, message: string) {
  send(sessionId, "log", { message });
}

export function getActiveSessions(): string[] {
  return Array.from(connections.keys());
}
