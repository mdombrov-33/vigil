import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllHeroes, getHeroById } from "@/db/queries/heroes.js";

export function registerHeroResources(server: McpServer) {
  server.registerResource(
    "heroes",
    "vigil://heroes",
    {
      description: "Full hero roster with stats, bio, and current availability",
      mimeType: "application/json",
    },
    async (uri) => {
      const heroes = await getAllHeroes();
      return {
        contents: [{ uri: uri.toString(), mimeType: "application/json", text: JSON.stringify(heroes) }],
      };
    },
  );

  server.registerResource(
    "hero",
    new ResourceTemplate("vigil://heroes/{heroId}", {
      list: async () => {
        const heroes = await getAllHeroes();
        return {
          resources: heroes.map((h) => ({
            uri: `vigil://heroes/${h.id}`,
            name: h.alias,
            description: `${h.alias} (${h.name}) — ${h.health}, ${h.availability}`,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      description: "Individual hero profile with stats and bio",
      mimeType: "application/json",
    },
    async (uri, { heroId }) => {
      const hero = await getHeroById(heroId as string);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "application/json",
            text: hero
              ? JSON.stringify(hero)
              : JSON.stringify({ error: `Hero ${heroId} not found` }),
          },
        ],
      };
    },
  );
}
