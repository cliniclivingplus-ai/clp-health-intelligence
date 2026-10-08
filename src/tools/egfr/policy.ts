import type { EgfrOutput } from "./schema.js";

type Category = EgfrOutput["category"];
type Presentation = Pick<EgfrOutput, "severity" | "guidance" | "cta">;

const CONSULT_CTA = { show: true, type: "consultation", label: "Consult Clinic Living Plus" } as const;
const NO_CTA = { show: false } as const;

/**
 * Safety / CTA policy for eGFR. This is the only place that decides what a KDIGO
 * category means for the reader; the UI renders these fields and never interprets the category.
 */
export function getPresentation(category: Category): Presentation {
  switch (category) {
    case "G1":
    case "G2":
      return {
        severity: "normal",
        guidance: "This estimate is in a range that is usually not a concern on its own. Kidney health is judged together with other tests (such as urine albumin) and your clinical history.",
        cta: NO_CTA
      };
    case "G3a":
      return {
        severity: "follow_up",
        guidance: "This estimate is below the usual range. It is worth discussing with a healthcare professional, who may repeat the test and check urine albumin to see whether it persists.",
        cta: CONSULT_CTA
      };
    case "G3b":
    case "G4":
      return {
        severity: "concerning",
        guidance: "This estimate is clearly reduced. Please arrange a medical evaluation soon so the cause can be assessed and the result confirmed.",
        cta: CONSULT_CTA
      };
    case "G5":
      return {
        severity: "urgent",
        guidance: "This estimate is in the kidney failure range. Seek prompt medical care today, especially with symptoms such as swelling, breathlessness, vomiting or very little urine. If you feel seriously unwell, go to the nearest emergency department.",
        cta: NO_CTA
      };
  }
}
