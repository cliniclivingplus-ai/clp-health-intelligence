import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { createMcpHandler, isJsonContentType, type AuthInfo } from "@modelcontextprotocol/server";
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createServer as createMcpServer } from "./server.js";
import type { HttpConfig } from "./config.js";

/**
 * Stateless Streamable HTTP front end for the MCP server.
 *
 * - Every request is served by a fresh `createMcpServer()` instance (the same factory stdio uses).
 * - No sessions, no database, no persistence. Request bodies are parsed in memory, handed to the
 *   handler and discarded.
 * - Logs never contain request bodies or tool arguments; only method, tool name, status and timing.
 */

export interface AccessLogEntry {
  ts: string;
  requestId: string;
  httpMethod: string;
  path: string;
  mcpMethod?: string;
  tool?: string;
  status: number;
  durationMs: number;
}

export interface HttpAppOptions {
  config: HttpConfig;
  log?: (entry: AccessLogEntry) => void;
  onError?: (error: Error) => void;
  /**
   * Extension point for authentication (not enabled in the proof of concept).
   * Return AuthInfo to attach to the request, `undefined` to proceed anonymously, or `false` to reject with 401.
   */
  authenticate?: (req: IncomingMessage) => Promise<AuthInfo | undefined | false> | AuthInfo | undefined | false;
}

const SAFE_NAME = /^[A-Za-z0-9_./-]{1,64}$/;
const safeName = (value: unknown): string | undefined => (typeof value === "string" && SAFE_NAME.test(value) ? value : undefined);

function jsonRpcError(res: ServerResponse, status: number, code: number, message: string, extraHeaders: Record<string, string> = {}) {
  if (res.headersSent) return;
  res.writeHead(status, { "content-type": "application/json", ...extraHeaders });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }));
}

class BodyTooLargeError extends Error {}

async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > limit) throw new BodyTooLargeError();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buf.length;
    if (size > limit) throw new BodyTooLargeError();
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Fixed-window in-memory limiter, per client address. Per instance: a POC safeguard, not a global quota. */
function createRateLimiter(perMinute: number) {
  const windows = new Map<string, { start: number; count: number }>();
  const sweep = setInterval(() => {
    const cutoff = Date.now() - 60_000;
    for (const [key, w] of windows) if (w.start < cutoff) windows.delete(key);
  }, 60_000);
  sweep.unref();
  return {
    /** Returns seconds to wait if limited, otherwise 0. */
    check(key: string): number {
      const now = Date.now();
      const w = windows.get(key);
      if (!w || now - w.start >= 60_000) {
        windows.set(key, { start: now, count: 1 });
        return 0;
      }
      w.count += 1;
      return w.count > perMinute ? Math.max(1, Math.ceil((w.start + 60_000 - now) / 1000)) : 0;
    },
    stop: () => clearInterval(sweep)
  };
}

function clientAddress(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function createHttpApp(options: HttpAppOptions): { server: Server; close: () => Promise<void> } {
  const { config } = options;
  const log = options.log ?? ((entry: AccessLogEntry) => console.log(JSON.stringify(entry)));
  const onError = options.onError ?? ((error: Error) => console.error(JSON.stringify({ level: "error", message: error.message })));

  const mcp = createMcpHandler(() => createMcpServer(), { onerror: onError, maxRequestBodySize: config.maxBodyBytes });
  const handleMcp = toNodeHandler(mcp, { onerror: onError, maxRequestBodySize: config.maxBodyBytes });
  const validateHost = hostHeaderValidation(config.allowedHosts);
  const validateOrigin = originValidation(config.allowedOrigins);
  const limiter = createRateLimiter(config.rateLimitPerMinute);

  const server = createHttpServer(async (req, res) => {
    const started = process.hrtime.bigint();
    const requestId = randomUUID();
    const path = (req.url ?? "/").split("?")[0];
    const entry: Pick<AccessLogEntry, "mcpMethod" | "tool"> = {};

    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-request-id", requestId);
    res.on("finish", () => {
      log({
        ts: new Date().toISOString(),
        requestId,
        httpMethod: req.method ?? "?",
        path: path.length > 64 ? path.slice(0, 64) : path,
        ...entry,
        status: res.statusCode,
        durationMs: Math.round(Number(process.hrtime.bigint() - started) / 1e4) / 100
      });
    });

    try {
      if (path === "/health") {
        if (req.method !== "GET" && req.method !== "HEAD") return jsonRpcError(res, 405, -32000, "Method not allowed.", { allow: "GET, HEAD" });
        res.writeHead(200, { "content-type": "application/json" });
        return void res.end(JSON.stringify({ status: "ok", service: "clp-health-intelligence" }));
      }

      if (path !== "/mcp") return jsonRpcError(res, 404, -32000, "Not found.");

      // DNS-rebinding protection: both guards answer 403 themselves when they return false.
      if (!validateHost(req, res)) return;
      if (!validateOrigin(req, res)) return;

      const origin = req.headers.origin;
      if (typeof origin === "string") {
        res.setHeader("access-control-allow-origin", origin);
        res.setHeader("vary", "Origin");
        res.setHeader("access-control-expose-headers", "mcp-session-id, x-request-id");
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
          "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, authorization",
          "access-control-max-age": "600"
        });
        return void res.end();
      }

      const retryAfter = limiter.check(clientAddress(req, config.trustProxy));
      if (retryAfter > 0) return jsonRpcError(res, 429, -32000, "Too many requests.", { "retry-after": String(retryAfter) });

      if (options.authenticate) {
        const auth = await options.authenticate(req);
        if (auth === false) return jsonRpcError(res, 401, -32001, "Unauthorized.");
        if (auth) (req as IncomingMessage & { auth?: AuthInfo }).auth = auth;
      }

      let parsedBody: unknown;
      if (req.method === "POST") {
        if (!isJsonContentType(req.headers["content-type"])) return jsonRpcError(res, 415, -32000, "Content-Type must be application/json.");
        let text: string;
        try {
          text = await readBody(req, config.maxBodyBytes);
        } catch (error) {
          if (error instanceof BodyTooLargeError) return jsonRpcError(res, 413, -32000, "Request body too large.", { connection: "close" });
          throw error;
        }
        try {
          parsedBody = JSON.parse(text);
        } catch {
          return jsonRpcError(res, 400, -32700, "Parse error.");
        }
        // Only the protocol method and tool NAME are recorded; arguments are never read into logs.
        const message = Array.isArray(parsedBody) ? parsedBody[0] : parsedBody;
        if (message && typeof message === "object") {
          const m = message as { method?: unknown; params?: { name?: unknown } };
          entry.mcpMethod = safeName(m.method);
          if (m.method === "tools/call") entry.tool = safeName(m.params?.name);
        }
      }

      await handleMcp(req, res, parsedBody);
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Unknown error"));
      jsonRpcError(res, 500, -32603, "Internal server error.");
    }
  });

  // Defensive timeouts for a public-facing process.
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;

  return {
    server,
    close: async () => {
      limiter.stop();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      await mcp.close();
    }
  };
}
