import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerGetAvailableHeroes } from "./tools/get_available_heroes.js";
import { registerGetHeroProfile } from "./tools/get_hero_profile.js";
import { registerGetHeroMissionHistory } from "./tools/get_hero_mission_history.js";
import { registerUpdateHeroState } from "./tools/update_hero_state.js";
import { registerSaveMissionReport } from "./tools/save_mission_report.js";
import { registerSaveDispatchRecommendation } from "./tools/save_dispatch_recommendation.js";
import { registerGetDispatchRecommendation } from "./tools/get_dispatch_recommendation.js";

function createServer() {
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

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createServer();
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createServer();
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

app.delete("/mcp", (_req, res) => {
  res.status(200).end();
});

const PORT = process.env.MCP_PORT ?? 3002;
app.listen(PORT, () => {
  console.log(`Vigil MCP server running on http://localhost:${PORT}/mcp`);
});
