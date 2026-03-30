import { useQuery } from "@tanstack/react-query";
import type { Hero } from "@/types/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function fetchHeroes(): Promise<Hero[]> {
  const res = await fetch(`${API}/api/v1/heroes`);
  if (!res.ok) throw new Error("Failed to fetch heroes");
  return res.json();
}

export function useHeroes() {
  return useQuery({
    queryKey: ["heroes"],
    queryFn: fetchHeroes,
    staleTime: Infinity, // SSE hero:state_update drives availability changes
  });
}
