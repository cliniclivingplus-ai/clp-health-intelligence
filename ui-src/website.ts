import { renderMetabolic } from "./metabolic-render.js";
const form = document.querySelector<HTMLFormElement>("form[data-tool]");
const result = document.getElementById("result")!;
const status = document.getElementById("status")!;
let revision = 0;
function updateConditionalFields() {
  for (const field of Array.from(form?.querySelectorAll<HTMLElement>("[data-when-field]") ?? [])) {
    const controlling = form!.elements.namedItem(field.dataset.whenField!) as HTMLSelectElement;
    const active = controlling?.value === field.dataset.whenValue;
    field.hidden = !active;
    for (const control of Array.from(field.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input,select"))) control.disabled = !active;
  }
}
updateConditionalFields();
form?.addEventListener("change", updateConditionalFields);
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const submittedRevision = revision;
  const input: Record<string, unknown> = {};
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement) || element.disabled || !element.name || element.value === "") continue;
    const value = element.dataset.type === "boolean" ? element.value === "true"
      : element.type === "number" || element.dataset.type === "number" ? Number(element.value) : element.value;
    if (element.name.includes(".")) {
      const [domain, index] = element.name.split(".");
      const answers = (input[domain] ??= []) as unknown[];
      answers[Number(index)] = value;
    } else input[element.name] = value;
  }
  result.hidden = true; status.hidden = false; status.textContent = "Calculating…"; button.disabled = true;
  try {
    const response = await fetch("/api/calculate", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: form.dataset.tool, input }) });
    const data = await response.json();
    if (submittedRevision !== revision) return;
    if (!response.ok) throw new Error(data.error ?? "Please check your inputs and try again.");
    renderMetabolic(data, result); status.hidden = true;
  } catch (error) {
    if (submittedRevision !== revision) return;
    status.textContent = error instanceof Error ? error.message : "Unable to calculate. Please try again.";
  } finally { button.disabled = false; }
});
form?.addEventListener("input", () => {
  revision += 1;
  if (!result.hidden) { result.hidden = true; status.hidden = false; status.textContent = "Inputs changed. Calculate again for an updated result."; }
});
form?.addEventListener("reset", () => {
  revision += 1;
  result.hidden = true; status.hidden = false; status.textContent = "Your result will appear here.";
  setTimeout(updateConditionalFields, 0);
});
