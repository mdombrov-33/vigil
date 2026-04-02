import type { Hero, Session, DebriefHero } from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(err.error ?? err.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

async function apiPost(path: string, body?: unknown): Promise<void> {
  const options: RequestInit = { method: "POST" };
  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(err.error ?? err.message ?? res.statusText);
  }
}

export const api = {
  sessions: {
    create: () =>
      apiFetch<Session>("/api/v1/sessions", { method: "POST" }),
    get: (id: string) =>
      apiFetch<Session>(`/api/v1/sessions/${id}`),
    start: (id: string) =>
      apiFetch<{ started: boolean }>(`/api/v1/sessions/${id}/start`, { method: "POST" }),
    pause: (id: string) =>
      apiPost(`/api/v1/sessions/${id}/pause`),
    resume: (id: string) =>
      apiPost(`/api/v1/sessions/${id}/resume`),
  },
  heroes: {
    list: () =>
      apiFetch<Hero[]>("/api/v1/heroes"),
  },
  incidents: {
    dispatch: (id: string, heroIds: string[]) =>
      apiPost(`/api/v1/incidents/${id}/dispatch`, { heroIds }),
    interrupt: (id: string, choiceId: string) =>
      apiPost(`/api/v1/incidents/${id}/interrupt`, { choiceId }),
    debrief: (id: string) =>
      apiFetch<{ heroes: DebriefHero[] }>(`/api/v1/incidents/${id}/debrief`),
    acknowledge: (id: string) =>
      apiPost(`/api/v1/incidents/${id}/acknowledge`),
  },
};
