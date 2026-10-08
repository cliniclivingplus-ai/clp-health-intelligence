// Presentation-only MCP App for calculate_egfr, built on the official ext-apps SDK.
// It renders the structured tool result. No clinical formula and no interpretation of the
// KDIGO category lives here: severity, guidance and CTA visibility all come from the tool.
import { App } from "@modelcontextprotocol/ext-apps";
import type { EgfrOutput } from "../src/tools/egfr/schema.js";

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const app = new App({ name: "clp-egfr-card", version: "1.0.0" });
let ctaUrl: string | undefined;

function render(r: EgfrOutput) {
  $("egfr").textContent = String(r.egfr);
  $("unit").textContent = r.unit;
  $("badge").textContent = "KDIGO " + r.category;
  $("badge").setAttribute("data-severity", r.severity);
  $("catdesc").textContent = r.categoryDescription;
  $("guidance").textContent = r.guidance;
  $("clinicalNote").textContent = r.clinicalNote;
  $("disclaimer").textContent = r.disclaimer;
  ctaUrl = r.cta.url;
  $("cta").hidden = !r.cta.show;
  if (r.cta.show) {
    const btn = $("ctaBtn") as HTMLButtonElement;
    btn.textContent = r.cta.label ?? "Consult Clinic Living Plus";
    btn.disabled = !ctaUrl;
    $("ctaHint").hidden = !!ctaUrl;
  }
  $("status").hidden = true;
  $("result").hidden = false;
}

app.ontoolresult = (result) => {
  if (result.isError || !result.structuredContent) {
    $("status").textContent = "The calculation could not be completed.";
    return;
  }
  render(result.structuredContent as unknown as EgfrOutput);
};

$("ctaBtn").addEventListener("click", async () => {
  if (!ctaUrl) return;
  try {
    const res = await app.openLink({ url: ctaUrl });
    if (res.isError) window.open(ctaUrl, "_blank", "noopener");
  } catch {
    window.open(ctaUrl, "_blank", "noopener");
  }
});

app.connect().catch(() => {
  $("status").textContent = "Unable to connect to the host.";
});
