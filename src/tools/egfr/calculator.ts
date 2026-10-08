import { getPresentation } from "./policy.js";
import type { EgfrInput, EgfrOutput } from "./schema.js";

const TOOL_VERSION = "1.0.0";
const CREATININE_UMOL_L_PER_MG_DL = 88.4;

type Category = EgfrOutput["category"];

function getCategory(egfr: number): { category: Category; description: string } {
  if (egfr >= 90) return { category: "G1", description: "Normal or high" };
  if (egfr >= 60) return { category: "G2", description: "Mildly decreased" };
  if (egfr >= 45) return { category: "G3a", description: "Mildly to moderately decreased" };
  if (egfr >= 30) return { category: "G3b", description: "Moderately to severely decreased" };
  if (egfr >= 15) return { category: "G4", description: "Severely decreased" };
  return { category: "G5", description: "Kidney failure range" };
}

export function calculateEgfr(input: EgfrInput): EgfrOutput {
  const creatinineMgDl = input.creatinineUnit === "umol/L"
    ? input.creatinine / CREATININE_UMOL_L_PER_MG_DL
    : input.creatinine;

  if (!Number.isFinite(creatinineMgDl) || creatinineMgDl <= 0) {
    throw new Error("Creatinine must be a positive finite number.");
  }

  // 2021 CKD-EPI creatinine equation, race-free:
  // eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^-1.200 × 0.9938^Age × 1.012 [if female]
  const kappa = input.sex === "female" ? 0.7 : 0.9;
  const alpha = input.sex === "female" ? -0.241 : -0.302;
  const sexCoefficient = input.sex === "female" ? 1.012 : 1;
  const scrOverKappa = creatinineMgDl / kappa;

  const rawEgfr = 142
    * Math.pow(Math.min(scrOverKappa, 1), alpha)
    * Math.pow(Math.max(scrOverKappa, 1), -1.2)
    * Math.pow(0.9938, input.age)
    * sexCoefficient;

  const egfr = Math.round(rawEgfr);
  const { category, description } = getCategory(egfr);

  return {
    tool: "calculate_egfr",
    toolVersion: TOOL_VERSION,
    egfr,
    unit: "mL/min/1.73m²",
    category,
    categoryDescription: description,
    creatinineMgDl: Number(creatinineMgDl.toFixed(3)),
    raceCoefficientUsed: false,
    ...getPresentation(category),
    clinicalNote: "eGFR is an estimate of kidney filtration and should be interpreted with the clinical context and other relevant tests. A single eGFR value does not by itself diagnose chronic kidney disease.",
    disclaimer: "Educational estimate only; not a diagnosis or a substitute for evaluation by a qualified healthcare professional."
  };
}
