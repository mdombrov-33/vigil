import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { saveDispatchRecommendation } from "../handlers/recommendations.js";

export function registerSaveDispatchRecommendation(server: McpServer) {
  server.registerTool(
    "save_dispatch_recommendation",
    {
      description:
        "Store the DispatcherAgent's hidden hero recommendation for an incident. Retrieved later by EvalAgent after the player dispatches.",
      inputSchema: {
        incident_id: z.uuid().describe("The incident's UUID"),
        recommended_hero_ids: z
          .array(z.uuid())
          .describe("Ordered list of recommended hero UUIDs, best first"),
        reasoning: z
          .string()
          .describe("Why these heroes were chosen for this incident"),
      },
    },
    async ({ incident_id, recommended_hero_ids, reasoning }) => {
      await saveDispatchRecommendation(incident_id, recommended_hero_ids, reasoning);
      return {
        content: [
          {
            type: "text" as const,
            text: `Dispatch recommendation saved for incident ${incident_id}.`,
          },
        ],
      };
    },
  );
}
