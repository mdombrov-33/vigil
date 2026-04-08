import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getHeroMissionHistory } from "@/db/queries/heroes.js";

export function registerGetHeroMissionHistory(server: McpServer) {
  server.registerTool(
    "get_hero_mission_history",
    {
      description:
        "Get the last 5 missions for a hero this session, including incident context and report. Used by HeroAgent as memory when writing in-character reports.",
      inputSchema: {
        hero_id: z.uuid().describe("The hero's UUID"),
        session_id: z.uuid().describe("The current session UUID — limits history to this session only"),
      },
    },
    async ({ hero_id, session_id }) => {
      const result = await getHeroMissionHistory(hero_id, session_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
    },
  );
}
