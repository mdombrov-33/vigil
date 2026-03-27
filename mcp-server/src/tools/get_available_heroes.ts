import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAvailableHeroes } from "../handlers/heroes.js";

export function registerGetAvailableHeroes(server: McpServer) {
  server.registerTool(
    "get_available_heroes",
    {
      description:
        "Get all heroes available for dispatch — availability is 'available' and health is not 'down'.",
    },
    async () => {
      const result = await getAvailableHeroes();
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    },
  );
}
