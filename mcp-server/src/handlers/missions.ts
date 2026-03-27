import { db, missions } from "@vigil/db";
import { eq } from "drizzle-orm";

export async function saveMissionReport(
  missionId: string,
  outcome: "success" | "failure",
  report: string,
) {
  await db
    .update(missions)
    .set({ outcome, report, completedAt: new Date() })
    .where(eq(missions.id, missionId));
}
