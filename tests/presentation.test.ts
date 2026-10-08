import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { calculateEgfr, getPresentation, EGFR_UI_HTML, EGFR_UI_URI } from "../src/tools/egfr/index.js";

test("CTA policy: shown for G3a/G3b/G4, hidden for G1/G2 and urgent G5", () => {
  assert.equal(getPresentation("G1").cta.show, false);
  assert.equal(getPresentation("G2").cta.show, false);
  assert.equal(getPresentation("G3a").cta.show, true);
  assert.equal(getPresentation("G3b").cta.show, true);
  assert.equal(getPresentation("G4").cta.show, true);
  assert.equal(getPresentation("G5").cta.show, false);
  assert.equal(getPresentation("G5").severity, "urgent");
});

test("tool result carries the CTA decision and never a hard-coded URL", () => {
  const result = calculateEgfr({ age: 45, sex: "male", creatinine: 1.5, creatinineUnit: "mg/dL" });
  assert.equal(result.severity, "follow_up");
  assert.equal(result.cta.show, true);
  assert.equal(result.cta.url, undefined);
});

test("UI card source contains no clinical formula, category logic or hard-coded URL", () => {
  const source = readFileSync("ui-src/egfr-app.ts", "utf8") + readFileSync("ui-src/egfr.html", "utf8");
  for (const forbidden of ["0.9938", "142", "1.012", "0.302", "G3a", "G3b", "Math.pow", "http://", "https://"]) {
    assert.equal(source.includes(forbidden), false, "UI source must not contain " + forbidden);
  }
});

test("generated UI bundle embeds the official ext-apps App and the card markup", () => {
  assert.ok(EGFR_UI_HTML.includes("CLP Health Intelligence"));
  assert.ok(EGFR_UI_HTML.includes("ui/initialize"));
});

test("MCP stdio: tool is linked to its UI resource and the resource is readable", async () => {
  const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], { stdio: ["pipe", "pipe", "inherit"] });
  const responses = new Map<number, any>();
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) { const msg = JSON.parse(line); if (msg.id !== undefined) responses.set(msg.id, msg); }
    }
  });
  const send = (msg: object) => child.stdin.write(JSON.stringify(msg) + "\n");
  const waitFor = async (id: number) => {
    for (let i = 0; i < 200 && !responses.has(id); i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(responses.has(id), "no response for id " + id);
    return responses.get(id);
  };
  try {
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } } });
    await waitFor(1);
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const tools = (await waitFor(2)).result.tools;
    const egfr = tools.find((t: any) => t.name === "calculate_egfr");
    assert.equal(egfr._meta.ui.resourceUri, EGFR_UI_URI);

    send({ jsonrpc: "2.0", id: 3, method: "resources/read", params: { uri: EGFR_UI_URI } });
    const content = (await waitFor(3)).result.contents[0];
    assert.equal(content.mimeType, "text/html;profile=mcp-app");
    assert.ok(content.text.includes("CLP Health Intelligence"));

    send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "calculate_egfr", arguments: { age: 45, sex: "male", creatinine: 1.5 } } });
    const out = (await waitFor(4)).result.structuredContent;
    assert.equal(out.egfr, 58);
    assert.equal(out.cta.show, true);
  } finally {
    child.kill();
  }
});
