// Local test harness: spawns the real MCP server over stdio and serves a browser host page.
// Run: npm run harness   then open http://localhost:5173
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const PORT = Number(process.env.PORT ?? 5173);

const client = new Client({ name: "clp-test-harness", version: "0.1.0" });
// MCP_URL=http://localhost:3000/mcp drives the Streamable HTTP server; otherwise the stdio server is spawned.
const mcpUrl = process.env.MCP_URL;
await client.connect(
  mcpUrl
    ? new StreamableHTTPClientTransport(new URL(mcpUrl))
    : new StdioClientTransport({
        command: process.execPath,
        args: ["--import", "tsx", "src/index.ts"],
        env: { ...(process.env as Record<string, string>), CLP_CONSULTATION_URL: process.env.CLP_CONSULTATION_URL ?? "https://example.com/book-consultation" },
        stderr: "inherit"
      })
);
console.log(mcpUrl ? "Harness transport: Streamable HTTP -> " + mcpUrl : "Harness transport: stdio");

const bundle = await build({
  entryPoints: ["harness/host.ts"],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2022",
  alias: { "@modelcontextprotocol/ext-apps/app-bridge": "@modelcontextprotocol/ext-apps/app-bridge" }
});
const hostJs = bundle.outputFiles[0].text;
const indexHtml = readFileSync("harness/index.html", "utf8");

const readBody = (req: import("node:http").IncomingMessage) =>
  new Promise<string>((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d)); });

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const send = (type: string, body: string, status = 200) => { res.writeHead(status, { "content-type": type }); res.end(body); };
  try {
    if (url.pathname === "/") return send("text/html", indexHtml);
    if (url.pathname === "/host.js") return send("text/javascript", hostJs);
    if (url.pathname === "/api/tools") return send("application/json", JSON.stringify(await client.listTools()));
    if (url.pathname === "/api/resource") return send("application/json", JSON.stringify(await client.readResource({ uri: url.searchParams.get("uri")! })));
    if (url.pathname === "/api/call" && req.method === "POST") {
      const { name, arguments: args } = JSON.parse(await readBody(req));
      return send("application/json", JSON.stringify(await client.callTool({ name, arguments: args })));
    }
    send("text/plain", "not found", 404);
  } catch (e) {
    send("application/json", JSON.stringify({ error: String(e) }), 500);
  }
}).listen(PORT, () => console.log("CLP test host: http://localhost:" + PORT));
