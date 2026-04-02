import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useHeroes() {
  return useQuery({
    queryKey: ["heroes"],
    queryFn: api.heroes.list,
    staleTime: Infinity, // SSE hero:state_update drives availability changes
  });
}
