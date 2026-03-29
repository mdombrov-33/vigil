import { db, dispatchRecommendations } from "@/db/index.js";
import { eq } from "drizzle-orm";

export async function saveDispatchRecommendation(
  incidentId: string,
  recommendedHeroIds: string[],
  reasoning: string,
) {
  await db.insert(dispatchRecommendations).values({
    incidentId,
    recommendedHeroIds,
    reasoning,
  });
}

export async function getDispatchRecommendation(incidentId: string) {
  const result = await db
    .select()
    .from(dispatchRecommendations)
    .where(eq(dispatchRecommendations.incidentId, incidentId))
    .limit(1);
  return result[0] ?? null;
}
