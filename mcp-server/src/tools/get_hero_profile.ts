import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getHeroProfile } from "../handlers/heroes.js";

export function registerGetHeroProfile(server: McpServer) {
  server.registerTool(
    "get_hero_profile",
    {
      description:
        "Get the full profile for a single hero — stats, personality, bio, current status.",
      inputSchema: { hero_id: z.uuid().describe("The hero's UUID") },
    },
    async ({ hero_id }) => {
      const hero = await getHeroProfile(hero_id);
      const text = hero ? JSON.stringify(hero) : `Hero ${hero_id} not found.`;
      return { content: [{ type: "text" as const, text }] };
    },
  );
}
