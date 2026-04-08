import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDispatchRecommendation } from "@/db/queries/recommendations.js";

export function registerGetDispatchRecommendation(server: McpServer) {
  server.registerTool(
    "get_dispatch_recommendation",
    {
      description:
        "Retrieve the hidden dispatch recommendation for an incident. Called by EvalAgent after the player has dispatched.",
      inputSchema: {
        incident_id: z.uuid().describe("The incident's UUID"),
      },
    },
    async ({ incident_id }) => {
      const rec = await getDispatchRecommendation(incident_id);
      const text = rec
        ? JSON.stringify(rec)
        : `No recommendation found for incident ${incident_id}.`;
      return { content: [{ type: "text" as const, text }] };
    },
  );
}
