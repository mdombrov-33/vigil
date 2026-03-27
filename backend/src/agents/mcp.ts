import { MCPServerStreamableHttp } from "@openai/agents";

export const mcpServer = new MCPServerStreamableHttp({
  url: process.env.MCP_URL ?? "http://mcp-server:3002/mcp",
  name: "Vigil MCP Server",
  cacheToolsList: true,
});
