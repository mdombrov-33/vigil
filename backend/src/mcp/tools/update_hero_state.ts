import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { updateHeroState } from "../handlers/heroes.js";

export function registerUpdateHeroState(server: McpServer) {
  server.registerTool(
    "update_hero_state",
    {
      description:
        "Update a hero's availability, health, and cooldown after a mission completes.",
      inputSchema: {
        hero_id: z.uuid().describe("The hero's UUID"),
        availability: z
          .enum(["available", "on_mission", "resting"])
          .describe("New availability status"),
        health: z
          .enum(["healthy", "injured", "down"])
          .describe("New health status"),
        cooldown_until: z.iso
          .datetime()
          .optional()
          .describe("ISO timestamp when the hero becomes available again"),
      },
    },
    async ({ hero_id, availability, health, cooldown_until }) => {
      await updateHeroState(
        hero_id,
        availability,
        health,
        cooldown_until ? new Date(cooldown_until) : null,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: `Hero ${hero_id} updated: ${availability}, ${health}.`,
          },
        ],
      };
    },
  );
}
