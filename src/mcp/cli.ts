// Entry point: `leaselens-mcp` speaks MCP over stdio.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server";

const server = createServer();
await server.connect(new StdioServerTransport());
// Logs go to stderr; stdout is reserved for the protocol.
console.error("leaselens-mcp ready on stdio");
