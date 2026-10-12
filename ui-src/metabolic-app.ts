import { App } from "@modelcontextprotocol/ext-apps";
import { renderMetabolic } from "./metabolic-render.js";
import type { MetabolicResult } from "../src/tools/metabolic.js";
const app = new App({ name: "clp-health-result", version: "1.0.0" });
const result = document.getElementById("result")!;
const status = document.getElementById("status")!;
app.ontoolresult = (message) => {
  if (message.isError || !message.structuredContent) {
    result.hidden = true; status.hidden = false; status.textContent = "The calculation could not be completed."; return;
  }
  renderMetabolic(message.structuredContent as unknown as MetabolicResult, result, (url) => app.openLink({ url }));
  status.hidden = true;
};
app.connect().catch(() => { status.textContent = "Unable to connect to the host."; });
