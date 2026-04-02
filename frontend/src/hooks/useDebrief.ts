import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useDebrief(incidentId: string | null) {
  return useQuery({
    queryKey: ["debrief", incidentId],
    queryFn: () => api.incidents.debrief(incidentId!),
    enabled: !!incidentId,
    staleTime: Infinity, // debrief data is immutable once the mission completes
  });
}
