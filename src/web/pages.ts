import { HEALTH_CSS, WEBSITE_JS } from "./generated.js";
import { healthTools } from "../tools/registry.js";
import { extendedTools, type Field } from "../tools/extended.js";

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const number = (name: string, label: string, min: number, max: number, hint: string, required = true, step = "any") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="number" min="${min}" max="${max}" step="${step}" ${required ? "required" : ""} inputmode="decimal"><small>${hint}</small></label>`;
const select = (name: string, label: string, options: [string, string][], hint = "", type = "string", required = true, full = false) =>
  `<label class="field ${full ? "full" : ""}"><span>${label}</span><select name="${name}" data-type="${type}" ${required ? "required" : ""}><option value="">${required ? "Select an option" : "Not provided"}</option>${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join("")}</select>${hint ? `<small>${hint}</small>` : ""}</label>`;
const sexOptions: [string, string][] = [["male", "Male"], ["female", "Female"]];
const yesNo: [string, string][] = [["true", "Yes"], ["false", "No"]];
const unknown: [string, string][] = [["unknown", "Not sure / not assessed"], ["no", "No"], ["yes", "Yes"]];
const forms: Record<string, string> = {
  tool1: number("age", "Age", 18, 120, "Completed years · adults only", true, "1") +
    select("isPregnant", "Currently pregnant?", yesNo, "This assessment applies outside pregnancy.", "boolean") +
    number("weightKg", "Weight · kg", 20, 500, "Use your current measured weight.") +
    number("heightCm", "Height · cm", 100, 250, "For example, 170 cm; measure without shoes."),
  tool2: number("hba1cPercent", "Laboratory HbA1c · %", 4, 20, "Enter the percentage on your report, for example 7.0. This field does not accept mmol/mol."),
  tool3: number("age", "Age", 20, 120, "Completed years · age 20 and above", true, "1") +
    select("sex", "Sex for waist thresholds", sexOptions) +
    number("waistCm", "Waist circumference · cm", 30, 250, "Measure midway between the lowest rib and hip bone after a normal breath out.") +
    select("parentsWithDiabetes", "Parents with diabetes", [["0", "Neither parent"], ["1", "One parent"], ["2", "Both parents"]], "If their history is unknown, clarify before scoring.", "number") +
    select("regularExercise", "Do you exercise regularly?", yesNo, "Regular planned exercise; an occasional walk does not establish regular exercise.", "boolean") +
    select("strenuousWork", "Does your work involve strenuous activity?", yesNo, "For example, sustained heavy manual work.", "boolean") +
    select("knownDiabetes", "Have you already been diagnosed with diabetes?", yesNo, "This tool screens for undiagnosed diabetes. It does not monitor known diabetes.", "boolean", true, true) +
    select("isPregnant", "Currently pregnant?", yesNo, "IDRS does not assess gestational diabetes.", "boolean", true, true)
};
const staging = `<details class="optional"><summary>Optional: explore 2025 obesity staging</summary><p class="panel-subtitle">A clinician must assess whether any health effects are related to obesity. Leave uncertain answers as unknown.</p><div class="form-grid">` +
  number("waistCm", "Waist circumference · cm", 30, 250, "Used with waist-to-height ratio.", false) +
  select("sex", "Sex for waist thresholds", sexOptions, "Needed to interpret sex-specific waist limits.", "string", false) +
  select("obesityRelatedCondition", "Obesity-related condition identified by a clinician?", unknown,
    "Examples include diabetes, hypertension, sleep apnoea or fatty liver.", "string", false, true) +
  select("functionalLimitation", "Obesity-related limitations in daily activities?", unknown,
    "Such as clinician-attributed difficulty with bathing, dressing or moving around.", "string", false, true) + "</div></details>";

const introductions: Record<string, string> = {
  tool1: "Understand your BMI using Indian adult cut-offs, then explore how waist measurements and health effects contribute to the 2025 obesity staging framework.",
  tool2: "Turn your laboratory HbA1c percentage into an estimated average glucose value. See the result in both mg/dL and mmol/L.",
  tool3: "A simple screening score based on age, waist circumference, activity and parental diabetes history. No blood test is needed to calculate the score."
};
function renderField(field: Field): string {
  const attributes = field.when ? ` data-when-field="${field.when[0]}" data-when-value="${field.when[1]}"` : "";
  const required = !field.optional;
  const input = field.type === "select"
    ? `<select name="${field.name}" data-type="${field.valueType ?? "string"}" ${required ? "required" : ""}><option value="">${required ? "Select an option" : "Not applicable / not provided"}</option>${field.options!.map(([value,text]) => `<option value="${value}">${escape(text)}</option>`).join("")}</select>`
    : `<input name="${field.name}" type="${field.type}" ${field.type === "number" ? `min="${field.min}" max="${field.max}" step="${field.step ?? "any"}" inputmode="decimal"` : ""} ${required ? "required" : ""}>`;
  return `<label class="field"${attributes}><span>${escape(field.label)}</span>${input}<small>${escape(field.hint ?? "")}</small></label>`;
}
for (const tool of extendedTools) { forms[tool.slug] = tool.fields.map(renderField).join(""); introductions[tool.slug] = tool.intro; }
function shell(title: string, content: string, script = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="Clinic Living Plus health calculators for Indian adults"><title>${escape(title)} · CLP Health Intelligence</title><style>${HEALTH_CSS}</style></head><body><header class="topbar"><a class="brand" href="/"><span class="mark">CLP</span><span><strong>Health Intelligence</strong><small>CLINIC LIVING PLUS</small></span></a><nav class="toplinks" aria-label="Main navigation"><a href="/">All tools</a><span class="pill">Evidence-based methods</span></nav></header>${content}<footer class="footer"><span>© ${new Date().getUTCFullYear()} Clinic Living Plus</span><span>Educational tools · Clinical sign-off pending</span></footer>${script ? `<script>${WEBSITE_JS}</script>` : ""}</body></html>`;
}

export function getHealthPage(path: string): string | undefined {
  const normalized = path === "/" ? path : path.replace(/\/$/, "");
  if (normalized === "/") {
    return shell("Health tools", `<main><p class="eyebrow">YOUR HEALTH, BETTER UNDERSTOOD</p><h1>A clearer picture<br>of your health.</h1><p class="intro">Practical tools from Clinic Living Plus. Explore your numbers, understand what they mean, and take an informed next step.</p><div class="tags"><span class="tag">Designed for Indian adults</span><span class="tag">No account needed</span><span class="tag">Calculations are not stored</span></div><section class="library" aria-label="Available health calculators">${healthTools.map((tool, i) => `<a class="tool-card" href="/${tool.slug}"><span class="tool-index">${String(i + 1).padStart(2, "0")}</span><h2>${tool.title}</h2><p>${introductions[tool.slug]}</p><span>Open calculator ↗</span></a>`).join("")}</section><section class="learn"><div><strong>One calculation engine</strong>These pages and compatible AI assistants use the same CLP tools.</div><div><strong>Understand the limits</strong>Every result includes context and references. These tools support a conversation with your healthcare professional.</div><div><strong>Your health inputs stay private</strong>Inputs are processed for the calculation and are not saved in a database or included in application access logs.</div></section></main>`);
  }
  const tool = healthTools.find((t) => normalized === `/${t.slug}`);
  if (!tool) return undefined;
  const method = "method" in tool ? tool.method : tool.slug === "tool1" ? "Indian cut-offs · 2025 staging" : tool.slug === "tool2" ? "ADAG study · ADA conversion" : "Mohan et al. · Original 2005 IDRS";
  return shell(tool.title, `<main><div class="breadcrumb"><a href="/">Health tools</a> / ${tool.title}</div><p class="eyebrow">CLINIC LIVING PLUS · TOOL ${tool.slug.slice(4)}</p><h1>${tool.title}</h1><p class="intro">${introductions[tool.slug]}</p><div class="tags"><span class="tag">${method}</span><span class="tag">Educational screening</span></div><div class="layout"><section class="panel"><h2>Your details</h2><p class="panel-subtitle">Use measured values and the units shown below.</p><form data-tool="${tool.name}"><div class="form-grid">${forms[tool.slug]}</div>${tool.slug === "tool1" ? staging : ""}<div class="actions"><button type="submit">Calculate result →</button><button type="reset" class="reset">Clear</button></div><p class="privacy">Health inputs are used only to calculate your result. They are not stored or included in application access logs.</p></form></section><section class="panel result-panel" aria-label="Calculation result" aria-live="polite"><p id="status" role="status">Your result will appear here.</p><div id="result" hidden></div></section></div><section class="learn"><div><strong>Use this as a starting point</strong>A result supports understanding and screening. It does not establish a diagnosis or a treatment plan.</div><div><strong>Built on published methods</strong>Clinical references and method limitations appear with each result. Clinical review of these implementations is pending.</div></section></main>`, true);
}

