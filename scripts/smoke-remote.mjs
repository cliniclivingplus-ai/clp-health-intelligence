import assert from "node:assert/strict";
import { extendedTools } from "../dist/tools/extended.js";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const base = process.argv[2];
if (!base) throw new Error("Usage: node scripts/smoke-remote.mjs https://your-host");
const health = await fetch(`${base}/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).status, "ok");
const client = new Client({ name: "clp-deployment-smoke", version: "1.0.0" });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === "calculate_egfr");
  assert.ok(tool);
  const newTools = [
    { name: "calculate_bmi", slug: "tool1", input: { age: 35, weightKg: 70, heightCm: 170, isPregnant: false }, field: "bmi", value: 24.22 },
    { name: "calculate_hba1c", slug: "tool2", input: { hba1cPercent: 7 }, field: "eagMgDl", value: 154.2 },
    { name: "calculate_idrs", slug: "tool3", input: { age: 45, sex: "male", waistCm: 92, regularExercise: true,
      strenuousWork: false, parentsWithDiabetes: 1, knownDiabetes: false, isPregnant: false }, field: "score", value: 60 }
  ];
  newTools.push(...extendedTools.map(t=>({name:t.name,slug:t.slug,input:t.example,field:"displayValue",value:t.calculate(t.example).displayValue})));
  assert.equal(tools.length,19);
  for (const example of newTools) {
    const discovered = tools.find((t) => t.name === example.name);
    assert.ok(discovered);
    const page = await fetch(`${base}/${example.slug}`);
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes(example.name));
    const called = await client.callTool({ name: example.name, arguments: example.input });
    assert.equal(called.isError, undefined);
    assert.equal(called.structuredContent[example.field], example.value);
    const website = await fetch(`${base}/api/calculate`, { method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ tool: example.name, input: example.input }) });
    assert.equal(website.status, 200);
    assert.deepEqual(await website.json(), called.structuredContent);
    const card = await client.readResource({ uri: discovered._meta.ui.resourceUri });
    assert.equal(card.contents[0].mimeType, "text/html;profile=mcp-app");
    console.log(`PASS: ${example.name}, /${example.slug}, website/MCP parity, MCP Apps resource`);
  }
  for (const [creatinine, creatinineUnit] of [[1.5, "mg/dL"], [132.6, "umol/L"]]) {
    const result = await client.callTool({ name: tool.name,
      arguments: { age: 45, sex: "male", creatinine, creatinineUnit } });
    assert.equal(result.structuredContent.egfr, 58);
    assert.equal(result.structuredContent.category, "G3a");
  }
  const invalid = await client.callTool({ name: tool.name,
    arguments: { age: 17, sex: "male", creatinine: 1.5, creatinineUnit: "mg/dL" } });
  assert.equal(invalid.isError, true);
  const uri = tool._meta.ui.resourceUri;
  const card = await client.readResource({ uri });
  assert.equal(card.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.ok(card.contents[0].text.includes("CLP"));
  const foreignOrigin = await fetch(`${base}/mcp`, { method: "POST",
    headers: { origin: "https://untrusted.example", "content-type": "application/json" }, body: "{}" });
  assert.equal(foreignOrigin.status, 403);
  console.log("PASS: health, MCP discovery, both creatinine units, input rejection, UI resource, Origin guard");
} finally {
  await client.close();
}
