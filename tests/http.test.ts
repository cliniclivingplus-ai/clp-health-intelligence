import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { request, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHttpApp, type AccessLogEntry } from "../src/http-app.js";
import { loadHttpConfig, type HttpConfig } from "../src/config.js";
import { calculateEgfr, EGFR_UI_URI } from "../src/tools/egfr/index.js";

const baseConfig: HttpConfig = { ...loadHttpConfig({}), port: 0, maxBodyBytes: 4096, rateLimitPerMinute: 1000 };

async function startApp(config: HttpConfig, logs: AccessLogEntry[] = []) {
  const app = createHttpApp({ config, log: (e) => logs.push(e), onError: () => {} });
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  const port = (app.server.address() as AddressInfo).port;
  return { app, port, base: `http://127.0.0.1:${port}`, logs };
}

function raw(port: number, opts: { method?: string; path?: string; headers?: Record<string, string>; body?: string }) {
  return new Promise<{ status: number; headers: IncomingHttpHeaders; text: string }>((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method: opts.method ?? "POST", path: opts.path ?? "/mcp", headers: opts.headers }, (res) => {
      let text = "";
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text }));
    });
    req.on("error", reject);
    req.end(opts.body);
  });
}

const rpc = (method: string, params?: object, id = 1) => JSON.stringify({ jsonrpc: "2.0", id, method, params });
const jsonHeaders = { "content-type": "application/json", accept: "application/json, text/event-stream" };

async function connectClient(base: string) {
  const client = new Client({ name: "http-test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
  return client;
}

let s: Awaited<ReturnType<typeof startApp>>;
before(async () => { s = await startApp(baseConfig); });
after(async () => { await s.app.close(); });

test("GET /health returns 200", async () => {
  const res = await raw(s.port, { method: "GET", path: "/health" });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.text).status, "ok");
});

test("MCP initialize and tools/list over HTTP, tool keeps its UI link", async () => {
  const client = await connectClient(s.base);
  try {
    const { tools } = await client.listTools();
    const egfr = tools.find((t) => t.name === "calculate_egfr");
    assert.ok(egfr, "calculate_egfr is listed");
    assert.equal((egfr._meta as any).ui.resourceUri, EGFR_UI_URI);
  } finally { await client.close(); }
});

test("calculate_egfr over HTTP: 45M, 1.5 mg/dL -> 58 / G3a", async () => {
  const client = await connectClient(s.base);
  try {
    const res: any = await client.callTool({ name: "calculate_egfr", arguments: { age: 45, sex: "male", creatinine: 1.5, creatinineUnit: "mg/dL" } });
    assert.equal(res.structuredContent.egfr, 58);
    assert.equal(res.structuredContent.category, "G3a");
  } finally { await client.close(); }
});

test("calculate_egfr over HTTP: 132.6 umol/L -> 58 / G3a", async () => {
  const client = await connectClient(s.base);
  try {
    const res: any = await client.callTool({ name: "calculate_egfr", arguments: { age: 45, sex: "male", creatinine: 132.6, creatinineUnit: "umol/L" } });
    assert.equal(res.structuredContent.egfr, 58);
    assert.equal(res.structuredContent.category, "G3a");
  } finally { await client.close(); }
});

test("age 17 returns an MCP validation error and no calculation result", async () => {
  const client = await connectClient(s.base);
  try {
    const res: any = await client.callTool({ name: "calculate_egfr", arguments: { age: 17, sex: "male", creatinine: 1.5 } });
    assert.equal(res.isError, true);
    assert.equal(res.structuredContent, undefined);
    assert.match(res.content[0].text, /validation/i);
  } finally { await client.close(); }
});

test("resources/read returns the card with the MCP Apps mime type", async () => {
  const client = await connectClient(s.base);
  try {
    const res = await client.readResource({ uri: EGFR_UI_URI });
    const content: any = res.contents[0];
    assert.equal(content.mimeType, "text/html;profile=mcp-app");
    assert.ok(content.text.includes("CLP Health Intelligence"));
  } finally { await client.close(); }
});

test("oversized body is rejected with 413", async () => {
  const big = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { pad: "x".repeat(8000) } });
  const res = await raw(s.port, { headers: { ...jsonHeaders, "content-length": String(Buffer.byteLength(big)) }, body: big });
  assert.equal(res.status, 413);
});

test("oversized body without a content-length is also rejected (chunked)", async () => {
  const big = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: { pad: "x".repeat(8000) } });
  const res = await raw(s.port, { headers: { ...jsonHeaders, "transfer-encoding": "chunked" }, body: big });
  assert.equal(res.status, 413);
});

test("invalid Host header is rejected", async () => {
  const res = await raw(s.port, { headers: { ...jsonHeaders, host: "evil.example.com" }, body: rpc("tools/list") });
  assert.equal(res.status, 403);
});

test("invalid Origin is rejected; allowed Origin is accepted", async () => {
  const bad = await raw(s.port, { headers: { ...jsonHeaders, origin: "https://evil.example.com" }, body: rpc("tools/list") });
  assert.equal(bad.status, 403);
  const ok = await raw(s.port, { headers: { ...jsonHeaders, origin: "http://localhost:5173" }, body: rpc("tools/list") });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers["access-control-allow-origin"], "http://localhost:5173");
});

test("CORS preflight for an allowed origin returns 204", async () => {
  const res = await raw(s.port, { method: "OPTIONS", headers: { origin: "http://localhost:5173", "access-control-request-method": "POST" } });
  assert.equal(res.status, 204);
  assert.ok(res.headers["access-control-allow-methods"]);
});

test("wrong content type, malformed JSON and unknown path are rejected cleanly", async () => {
  assert.equal((await raw(s.port, { headers: { "content-type": "text/plain" }, body: "hi" })).status, 415);
  assert.equal((await raw(s.port, { headers: jsonHeaders, body: "{not json" })).status, 400);
  assert.equal((await raw(s.port, { method: "GET", path: "/nope" })).status, 404);
});

test("stateless: no session id is issued, and two independent clients both work", async () => {
  const res = await raw(s.port, { headers: jsonHeaders, body: rpc("tools/list") });
  assert.equal(res.status, 200);
  assert.equal(res.headers["mcp-session-id"], undefined);
  const [a, b] = await Promise.all([connectClient(s.base), connectClient(s.base)]);
  try {
    const [ra, rb]: any[] = await Promise.all([
      a.callTool({ name: "calculate_egfr", arguments: { age: 45, sex: "male", creatinine: 1.5 } }),
      b.callTool({ name: "calculate_egfr", arguments: { age: 45, sex: "female", creatinine: 1.5 } })
    ]);
    assert.equal(ra.structuredContent.egfr, 58);
    assert.equal(rb.structuredContent.egfr, 44);
  } finally { await Promise.all([a.close(), b.close()]); }
});

test("30 concurrent calls return correct, independent results", async () => {
  const client = await connectClient(s.base);
  try {
    const inputs = Array.from({ length: 30 }, (_, i) => ({ age: 20 + i, sex: i % 2 ? "female" : "male", creatinine: 0.6 + i * 0.1, creatinineUnit: "mg/dL" as const }));
    const results: any[] = await Promise.all(inputs.map((arguments_) => client.callTool({ name: "calculate_egfr", arguments: arguments_ })));
    results.forEach((r, i) => assert.equal(r.structuredContent.egfr, calculateEgfr(inputs[i] as any).egfr, "result " + i));
  } finally { await client.close(); }
});

test("access logs never contain health values or arguments, only method/tool/status/timing", async () => {
  const logs: AccessLogEntry[] = [];
  const t = await startApp(baseConfig, logs);
  try {
    const client = await connectClient(t.base);
    await client.callTool({ name: "calculate_egfr", arguments: { age: 53, sex: "female", creatinine: 1.37, creatinineUnit: "mg/dL" } });
    await client.close();
    // Only the free-form fields can carry request content (ts and requestId are generated and contain arbitrary digits).
    const dump = JSON.stringify(logs.map(({ httpMethod, path, mcpMethod, tool }) => ({ httpMethod, path, mcpMethod, tool })));
    for (const secret of ["1.37", "53", "female", "creatinine", "age"]) assert.equal(dump.includes(secret), false, "log leaked " + secret);
    assert.deepEqual(Object.keys(logs[0]).sort(), Object.keys(logs[0]).filter((k) => ["ts", "requestId", "httpMethod", "path", "mcpMethod", "tool", "status", "durationMs"].includes(k)).sort(), "unexpected log field");
    const call = logs.find((l) => l.mcpMethod === "tools/call");
    assert.ok(call, "tools/call was logged");
    assert.equal(call.tool, "calculate_egfr");
    assert.equal(call.status, 200);
    assert.equal(typeof call.durationMs, "number");
  } finally { await t.app.close(); }
});

test("rate limiting returns 429 after the configured number of requests", async () => {
  const t = await startApp({ ...baseConfig, rateLimitPerMinute: 3 });
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await raw(t.port, { headers: jsonHeaders, body: rpc("tools/list", {}, i) })).status);
    assert.deepEqual(statuses.slice(0, 3), [200, 200, 200]);
    assert.deepEqual(statuses.slice(3), [429, 429]);
    assert.equal((await raw(t.port, { method: "GET", path: "/health" })).status, 200, "/health is not rate limited");
  } finally { await t.app.close(); }
});

test("authenticate hook can reject requests (extension point for later)", async () => {
  const app = createHttpApp({ config: baseConfig, authenticate: () => false, log: () => {}, onError: () => {} });
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  try {
    const res = await raw((app.server.address() as AddressInfo).port, { headers: jsonHeaders, body: rpc("tools/list") });
    assert.equal(res.status, 401);
  } finally { await app.close(); }
});

test("loadHttpConfig applies localhost-only defaults and validates numbers", () => {
  const c = loadHttpConfig({});
  assert.equal(c.host, "127.0.0.1");
  assert.deepEqual(c.allowedHosts, ["localhost", "127.0.0.1", "[::1]"]);
  assert.equal(c.maxBodyBytes, 65536);
  assert.throws(() => loadHttpConfig({ MAX_BODY_BYTES: "abc" }));
  assert.deepEqual(loadHttpConfig({ RENDER_EXTERNAL_HOSTNAME: "clp.onrender.com" }).allowedHosts, ["localhost", "127.0.0.1", "[::1]", "clp.onrender.com"]);
  assert.equal(loadHttpConfig({}).trustProxy, false);
  assert.deepEqual(loadHttpConfig({ ALLOWED_HOSTS: "mcp.example.com, other.example.com" }).allowedHosts, ["mcp.example.com", "other.example.com"]);
});
