import { loadHttpConfig } from "./config.js";
import { createHttpApp } from "./http-app.js";

// Streamable HTTP entry point (stateless). The stdio entry point is src/index.ts; both use createServer().
const config = loadHttpConfig();
const app = createHttpApp({ config });

app.server.listen(config.port, config.host, () => {
  console.log(JSON.stringify({
    level: "info",
    message: "CLP Health Intelligence MCP (Streamable HTTP, proof of concept) listening",
    url: `http://${config.host}:${config.port}/mcp`,
    allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins
  }));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(JSON.stringify({ level: "info", message: "shutting down", signal }));
    app.close().finally(() => process.exit(0));
  });
}
