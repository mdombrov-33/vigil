import { Router } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerGetAvailableHeroes } from "@/mcp/tools/get_available_heroes.js";
import { registerGetHeroProfile } from "@/mcp/tools/get_hero_profile.js";
import { registerGetHeroMissionHistory } from "@/mcp/tools/get_hero_mission_history.js";
import { registerUpdateHeroState } from "@/mcp/tools/update_hero_state.js";
import { registerSaveMissionReport } from "@/mcp/tools/save_mission_report.js";
import { registerSaveDispatchRecommendation } from "@/mcp/tools/save_dispatch_recommendation.js";
import { registerGetDispatchRecommendation } from "@/mcp/tools/get_dispatch_recommendation.js";

function createMcpServer() {
  const server = new McpServer({ name: "vigil-mcp", version: "1.0.0" });
  registerGetAvailableHeroes(server);
  registerGetHeroProfile(server);
  registerGetHeroMissionHistory(server);
  registerUpdateHeroState(server);
  registerSaveMissionReport(server);
  registerSaveDispatchRecommendation(server);
  registerGetDispatchRecommendation(server);
  return server;
}

const router = Router();

router.post("/", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

router.get("/", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

router.delete("/", (_req, res) => {
  res.status(200).end();
});

export default router;
