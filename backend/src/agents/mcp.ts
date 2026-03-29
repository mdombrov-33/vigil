import { MCPServerStreamableHttp } from "@openai/agents";

export const mcpServer = new MCPServerStreamableHttp({
  url: process.env.MCP_URL ?? `http://localhost:${process.env.PORT ?? 3001}/mcp`,
  name: "Vigil MCP Server",
  cacheToolsList: true,
});
