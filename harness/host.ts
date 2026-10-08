// Minimal MCP Apps host for local verification. Uses the official AppBridge, hosts the card in a
// sandboxed iframe (no allow-same-origin), and plays a real calculate_egfr result into it.
import { AppBridge, PostMessageTransport } from "@modelcontextprotocol/ext-apps/app-bridge";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const logEl = $("log");
function log(line: string) {
  logEl.textContent += new Date().toISOString().slice(11, 23) + "  " + line + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

async function api(path: string, body?: unknown) {
  const res = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
  return res.json();
}

let bridge: AppBridge | undefined;

async function run() {
  const args = {
    age: Number(($("age") as HTMLInputElement).value),
    sex: ($("sex") as HTMLSelectElement).value,
    creatinine: Number(($("creatinine") as HTMLInputElement).value),
    creatinineUnit: ($("unit") as HTMLSelectElement).value
  };
  $("frame-holder").innerHTML = "";
  logEl.textContent = "";
  document.body.removeAttribute("data-rendered");

  log("tools/list -> find tool UI link");
  const { tools } = await api("/api/tools");
  const tool = tools.find((t: any) => t.name === "calculate_egfr");
  const uri: string | undefined = tool?._meta?.ui?.resourceUri;
  log("calculate_egfr _meta.ui.resourceUri = " + uri);
  if (!uri) { log("ERROR: tool has no UI resource link"); return; }

  log("resources/read " + uri);
  const resource = await api("/api/resource?uri=" + encodeURIComponent(uri));
  const content = resource.contents[0];
  log("resource mimeType = " + content.mimeType + ", " + content.text.length + " chars");

  log("tools/call calculate_egfr " + JSON.stringify(args));
  const result = await api("/api/call", { name: "calculate_egfr", arguments: args });
  log("tool result egfr=" + result.structuredContent?.egfr + " category=" + result.structuredContent?.category);

  const iframe = document.createElement("iframe");
  // ?inspect=1 adds allow-same-origin so automated checks can read/click the card; default is fully sandboxed.
  iframe.setAttribute("sandbox", new URLSearchParams(location.search).has("inspect") ? "allow-scripts allow-same-origin" : "allow-scripts");
  iframe.style.cssText = "width:100%;height:120px;border:0;";
  iframe.setAttribute("scrolling", "no");
  $("frame-holder").appendChild(iframe);

  bridge = new AppBridge(null, { name: "CLP local test host", version: "0.1.0" }, { openLinks: {} });
  bridge.onsizechange = ({ height }) => { if (height) iframe.style.height = Math.ceil(height) + 4 + "px"; };
  bridge.onopenlink = async ({ url }) => {
    log("app requested ui/open-link -> " + url);
    document.body.setAttribute("data-open-link", url);
    return {};
  };
  bridge.oninitialized = () => {
    log("app initialized (ui/notifications/initialized) -> sending tool input + result");
    bridge!.sendToolInput({ arguments: args });
    bridge!.sendToolResult(result);
    setTimeout(() => document.body.setAttribute("data-rendered", "true"), 300);
  };
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  log("bridge connected; loading card into sandboxed iframe");
  iframe.srcdoc = content.text;
}

$("run").addEventListener("click", () => { run().catch((e) => log("ERROR: " + e)); });
run().catch((e) => log("ERROR: " + e));
