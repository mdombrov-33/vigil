import "dotenv/config";
import express from "express";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "@/db/index.js";
import { sendJson } from "@/utils/response";
import { incidentsRouter } from "@/api/v1/routes/incidents";
import { sessionsRouter } from "@/api/v1/routes/sessions";
import { heroesRouter } from "@/api/v1/routes/heroes";
import sseRouter from "@/api/v1/routes/sse";
import { mcpServer } from "@/agents/mcp";
import { initTracing } from "@/tracing";
import { startHeroRecovery } from "@/services/cooldown-resolver";
import { startIncidentScheduler } from "@/services/game-loop";
import mcpRouter from "@/mcp/router.js";

initTracing();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

app.get("/api/healthz", (_req, res) => {
  sendJson(res, 200, { status: "ok" });
});

app.use("/api/v1/sessions", sessionsRouter);
app.use("/api/v1/incidents", incidentsRouter);
app.use("/api/v1/heroes", heroesRouter);
app.use("/api/v1/sse", sseRouter);
app.use("/mcp", mcpRouter);

app.listen(PORT, async () => {
  console.log(`Vigil backend running on http://localhost:${PORT}`);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations complete");

  await mcpServer.connect();
  console.log("MCP server connected");
  startHeroRecovery();
  startIncidentScheduler();
});
