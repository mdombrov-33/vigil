import "dotenv/config";
import express from "express";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "@vigil/db";
import { sendJson } from "@/utils/response";
import { mcpServer } from "@/agents/mcp";
import { initTracing } from "@/tracing";

initTracing();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

app.get("/api/healthz", (_req, res) => {
  sendJson(res, 200, { status: "ok" });
});

console.log("Running migrations...");
await migrate(db, { migrationsFolder: "../packages/db/src/migrations" });
console.log("Migrations complete");

await mcpServer.connect();
console.log("MCP server connected");

app.listen(PORT, () => {
  console.log(`Vigil backend running on http://localhost:${PORT}`);
});
