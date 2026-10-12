import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHttpApp, type AccessLogEntry } from "../src/http-app.js";
import { loadHttpConfig } from "../src/config.js";
import { extendedTools } from "../src/tools/extended.js";

const logs: AccessLogEntry[] = [];
const app = createHttpApp({ config: { ...loadHttpConfig({}), port: 0 }, log: (entry) => logs.push(entry) });
let base: string;
before(async () => {
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});
after(async () => { await app.close(); });

const examples = [
  { tool: "calculate_bmi", input: { age: 35, weightKg: 70, heightCm: 170, isPregnant: false }, field: "bmi", value: 24.22 },
  { tool: "calculate_hba1c", input: { hba1cPercent: 7 }, field: "eagMgDl", value: 154.2 },
  { tool: "calculate_idrs", input: { age: 45, sex: "male", waistCm: 92, regularExercise: true, strenuousWork: false,
    parentsWithDiabetes: 1, knownDiabetes: false, isPregnant: false }, field: "score", value: 60 }
];

test("hub and all three pages serve accessible forms, unique tool names and navigation", async () => {
  const hub = await fetch(base + "/"); assert.equal(hub.status, 200);
  const html = await hub.text();
  for (let i = 1; i <= 18; i++) assert.ok(html.includes(`href="/tool${i}"`));
  for (const [i, example] of examples.entries()) {
    const response = await fetch(`${base}/tool${i + 1}`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type")?.includes("text/html"));
    const page = await response.text();
    assert.ok(page.includes(`data-tool="${example.tool}"`));
    assert.ok(page.includes('aria-live="polite"'));
    assert.ok(page.includes("Clinical sign-off pending"));
  }
  assert.equal((await fetch(base + "/tool1/")).status, 200);
  for (const tool of extendedTools) {
    const response = await fetch(`${base}/${tool.slug}`);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(`data-tool="${tool.name}"`));
  }
  assert.equal((await fetch(base + "/tool19")).status, 404);
});

test("all new tools work through MCP and the website API with identical results and readable cards", async () => {
  const client = new Client({ name: "health-tool-test", version: "1" });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(base + "/mcp")));
    const { tools } = await client.listTools();
    assert.equal(tools.length, 19);
    for (const example of examples) {
      const tool = tools.find((t) => t.name === example.tool)!;
      assert.ok(tool);
      const mcpResult = await client.callTool({ name: example.tool, arguments: example.input });
      assert.equal(mcpResult.isError, undefined);
      assert.equal((mcpResult.structuredContent as Record<string, unknown>)[example.field], example.value);
      const response = await fetch(base + "/api/calculate", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: example.tool, input: example.input }) });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), mcpResult.structuredContent);
      const uri = (tool._meta!.ui as { resourceUri: string }).resourceUri;
      const card = await client.readResource({ uri });
      assert.equal(card.contents[0].mimeType, "text/html;profile=mcp-app");
    }
    const invalid = await client.callTool({ name: "calculate_idrs", arguments: { ...examples[2].input, knownDiabetes: true } });
    assert.equal(invalid.isError, true);
  } finally { await client.close(); }
});

test("all fifteen additional tools return identical website/MCP results and readable cards", async () => {
  const client = new Client({name:"extended-tool-test",version:"1"});
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(base+"/mcp")));
    const {tools}=await client.listTools();
    for(const example of extendedTools) {
      const tool=tools.find(t=>t.name===example.name)!;
      assert.ok(tool);
      const called=await client.callTool({name:example.name,arguments:example.example});
      assert.equal(called.isError,undefined,example.name);
      const website=await fetch(base+"/api/calculate",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({tool:example.name,input:example.example})});
      assert.equal(website.status,200,example.name);
      assert.deepEqual(await website.json(),called.structuredContent,example.name);
      const card=await client.readResource({uri:(tool._meta!.ui as {resourceUri:string}).resourceUri});
      assert.equal(card.contents[0].mimeType,"text/html;profile=mcp-app");
      const invalid=await client.callTool({name:example.name,arguments:{}});
      assert.equal(invalid.isError,true,example.name);
    }
  } finally {await client.close();}
});

test("website API rejects malformed, inapplicable and cross-origin requests and never logs health inputs", async () => {
  for (const body of [null, { tool: "missing", input: {} }, { tool: "calculate_bmi", input: {} },
    { tool: "calculate_bmi", input: { ...examples[0].input, isPregnant: true } }]) {
    const res = await fetch(base + "/api/calculate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(res.status, 400);
  }
  const foreign = await fetch(base + "/api/calculate", { method: "POST", headers: { "content-type": "application/json", origin: "https://untrusted.example" }, body: "{}" });
  assert.equal(foreign.status, 403);
  assert.equal((await fetch(base + "/api/calculate")).status, 405);
  const serialized = JSON.stringify(logs);
  assert.ok(!serialized.includes("weightKg"));
  assert.ok(!serialized.includes("waistCm"));
  assert.ok(!serialized.includes("hba1cPercent"));
});
