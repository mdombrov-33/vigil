import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { saveMissionReport } from "../handlers/missions.js";

export function registerSaveMissionReport(server: McpServer) {
  server.registerTool(
    "save_mission_report",
    {
      description: "Persist the completed mission report and outcome to the database.",
      inputSchema: {
        mission_id: z.uuid().describe("The mission's UUID"),
        outcome: z.enum(["success", "failure"]).describe("Mission outcome"),
        report: z.string().describe("The in-character mission report text"),
      },
    },
    async ({ mission_id, outcome, report }) => {
      await saveMissionReport(mission_id, outcome, report);
      return {
        content: [
          {
            type: "text" as const,
            text: `Mission ${mission_id} report saved. Outcome: ${outcome}.`,
          },
        ],
      };
    },
  );
}
