import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getHeroMissionHistory } from "../handlers/heroes.js";

export function registerGetHeroMissionHistory(server: McpServer) {
  server.registerTool(
    "get_hero_mission_history",
    {
      description:
        "Get the last 5 missions for a hero, including incident context and report. Used by HeroAgent as memory when writing in-character reports.",
      inputSchema: {
        hero_id: z.uuid().describe("The hero's UUID"),
      },
    },
    async ({ hero_id }) => {
      const result = await getHeroMissionHistory(hero_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    },
  );
}
