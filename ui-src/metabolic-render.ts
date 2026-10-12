import type { MetabolicResult } from "../src/tools/metabolic.js";

export function renderMetabolic(result: MetabolicResult, root: HTMLElement, openLink?: (url: string) => Promise<unknown>) {
  root.replaceChildren();
  const append = (tag: string, text: string, className?: string) => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    root.append(node);
    return node;
  };
  append("p", "YOUR RESULT", "eyebrow");
  append("h2", result.title);
  const number = append("div", result.displayValue, "result-number");
  const unit = document.createElement("span"); unit.textContent = " " + result.unit; number.append(unit);
  append("p", result.category, "result-category");
  append("p", result.guidance, "guidance");
  root.dataset.severity = result.severity;
  const list = document.createElement("dl"); list.className = "details";
  for (const item of result.details) {
    const term = document.createElement("dt"); term.textContent = item.label;
    const value = document.createElement("dd"); value.textContent = item.value;
    list.append(term, value);
  }
  root.append(list);
  append("h3", "How to read this");
  const limits = document.createElement("ul"); limits.className = "limitations";
  for (const text of result.limitations) { const li = document.createElement("li"); li.textContent = text; limits.append(li); }
  root.append(limits);
  append("p", result.disclaimer, "disclaimer");
  if (result.cta.show && result.cta.url) {
    const link = document.createElement("a"); link.className = "button";
    link.textContent = result.cta.label ?? "Consult Clinic Living Plus";
    link.href = result.cta.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    if (openLink) link.addEventListener("click", (event) => { event.preventDefault(); void openLink(result.cta.url!); });
    root.append(link);
  }
  append("h3", "Clinical references");
  for (const ref of result.references) {
    const link = document.createElement("a"); link.className = "reference"; link.textContent = ref.title;
    link.href = ref.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    if (openLink) link.addEventListener("click", (event) => { event.preventDefault(); void openLink(ref.url); });
    root.append(link);
  }
  root.hidden = false;
}
