import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";

export function useSession(sessionId: string | null) {
  return useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => api.sessions.get(sessionId!),
    enabled: !!sessionId,
    staleTime: Infinity, // SSE drives updates, no polling needed
  });
}
