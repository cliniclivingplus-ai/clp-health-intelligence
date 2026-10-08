import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { createHttpApp } from "../src/http-app.js";
import { loadHttpConfig } from "../src/config.js";
import { EGFR_TOOL_DESCRIPTION, SERVER_INSTRUCTIONS } from "../src/tools/egfr/metadata.js";

// These tests check what an AI host actually receives (initialize + tools/list), not just the source constants.

const app = createHttpApp({ config: { ...loadHttpConfig({}), port: 0 }, log: () => {}, onError: () => {} });
let port = 0;

function rpc(method: string, params?: object, id = 1): Promise<any> {
  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  return new Promise((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port, method: "POST", path: "/mcp", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" } },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          const data = text.split("\n").find((l) => l.startsWith("data: "));
          resolve(JSON.parse(data ? data.slice(6) : text));
        });
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

before(async () => {
  await new Promise<void>((resolve) => app.server.listen(0, "127.0.0.1", resolve));
  port = (app.server.address() as AddressInfo).port;
});
after(async () => { await app.close(); });

const has = (text: string, needle: string) => assert.ok(text.toLowerCase().includes(needle.toLowerCase()), `missing: ${needle}`);

test("tool description sets the selection policy and keeps discovery terms", async () => {
  const tool = (await rpc("tools/list")).result.tools.find((t: any) => t.name === "calculate_egfr");
  assert.equal(tool.description, EGFR_TOOL_DESCRIPTION);
  for (const phrase of [
    "authoritative", "adult (18+)", "instead of calculating or converting eGFR yourself",
    "exactly as the user gave it", "ask the user; do not guess", "do not substitute another equation",
    "does not diagnose chronic kidney disease"
  ]) has(tool.description, phrase);
  for (const term of ["eGFR", "GFR", "kidney function", "creatinine", "blood test", "CKD-EPI", "mg/dL", "µmol/L", "umol/L"]) has(tool.description, term);
});

test("tool description is scoped: general education questions do not need the tool", () => {
  has(EGFR_TOOL_DESCRIPTION, "what is creatinine?");
  assert.equal(/whenever creatinine|always use this tool/i.test(EGFR_TOOL_DESCRIPTION), false, "description must not be overly broad");
});

test("server-level instructions are sent on initialize", async () => {
  const init = (await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "meta-test", version: "0" } })).result;
  assert.equal(init.instructions, SERVER_INSTRUCTIONS);
  for (const phrase of ["calculate_egfr", "rather than calculating or converting", "ask the user; never assume", "adult-only", "do not substitute another equation", "not a diagnosis"]) has(init.instructions, phrase);
});

test("parameter descriptions carry required / do-not-guess / do-not-convert guidance", async () => {
  const props = (await rpc("tools/list")).result.tools[0].inputSchema.properties;
  has(props.age.description, "do not guess");
  has(props.sex.description, "do not guess");
  has(props.creatinine.description, "do not convert");
  has(props.creatinineUnit.description, "Required");
  has(props.creatinineUnit.description, "exactly as provided by the user");
  has(props.creatinineUnit.description, "Do not convert the value yourself");
});

test("input contract: adults only, creatinineUnit is required with no default", async () => {
  const schema = (await rpc("tools/list")).result.tools[0].inputSchema;
  assert.equal(schema.properties.age.minimum, 18);
  assert.equal(schema.properties.age.maximum, 120);
  assert.deepEqual(schema.required, ["age", "sex", "creatinine", "creatinineUnit"]);
  assert.deepEqual(schema.properties.sex.enum, ["male", "female"]);
  assert.deepEqual(schema.properties.creatinineUnit.enum, ["mg/dL", "umol/L"]);
  assert.equal("default" in schema.properties.creatinineUnit, false, "no default unit is exposed");
});

test("a call without creatinineUnit is rejected and never calculates", async () => {
  const res = (await rpc("tools/call", { name: "calculate_egfr", arguments: { age: 45, sex: "male", creatinine: 1.5 } })).result;
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent, undefined);
  assert.match(res.content[0].text, /creatinineUnit/);
});

test("annotations: read-only, idempotent, closed world; UI link intact", async () => {
  const tool = (await rpc("tools/list")).result.tools[0];
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.idempotentHint, true);
  assert.equal(tool.annotations.openWorldHint, false);
  assert.equal(tool._meta.ui.resourceUri, "ui://clp-health-intelligence/egfr.html");
});
