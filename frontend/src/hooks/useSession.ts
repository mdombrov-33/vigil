import { useQuery } from "@tanstack/react-query";
import type { Session } from "@/types/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function createSession(): Promise<Session> {
  const res = await fetch(`${API}/api/v1/sessions`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function startSession(id: string): Promise<void> {
  const res = await fetch(`${API}/api/v1/sessions/${id}/start`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start session");
}

export async function fetchSession(id: string): Promise<Session> {
  const res = await fetch(`${API}/api/v1/sessions/${id}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

export function useSession(sessionId: string | null) {
  return useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => fetchSession(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity, // SSE drives updates, no polling
  });
}
