/**
 * Text that tells an AI host when and how to use the eGFR tool. Metadata only: nothing here
 * affects the calculation, validation or safety policy.
 */

export const EGFR_TOOL_DESCRIPTION =
  "CLP Health Intelligence's authoritative calculator for adult (18+) estimated GFR (eGFR) from serum creatinine, " +
  "using the 2021 race-free CKD-EPI equation. Use it when the user wants to calculate or interpret kidney function: " +
  "\"calculate my eGFR/GFR\", \"what is my kidney function\", \"what does my creatinine mean\", \"is my creatinine normal\" " +
  "(once age and sex are known), or a blood test report that lists creatinine. " +
  "Call this tool instead of calculating or converting eGFR yourself. Pass creatinine in mg/dL or µmol/L exactly as the " +
  "user gave it (use the unit value \"umol/L\" for µmol/L); the tool does the unit conversion. " +
  "If age, sex or the creatinine unit is missing, ask the user; do not guess. " +
  "Adults 18 and older only: if the person is under 18 or the tool cannot be used, say that this CLP tool does not apply " +
  "and do not substitute another equation. A single eGFR result does not diagnose chronic kidney disease. " +
  "General questions such as \"what is creatinine?\" do not need this tool.";

export const SERVER_INSTRUCTIONS =
  "CLP Health Intelligence provides validated health calculators. " +
  "For adult (18+) eGFR or kidney-function requests based on serum creatinine, use calculate_egfr rather than " +
  "calculating or converting values yourself. Pass creatinine in the unit the user gave (mg/dL or umol/L). " +
  "If age, sex or the unit is missing, ask the user; never assume. " +
  "The tool is adult-only: if it does not apply (for example under 18) or returns an error, say so and do not " +
  "substitute another equation. General educational questions (for example \"what is creatinine?\") do not need the tool. " +
  "Results are educational estimates, not a diagnosis.";

export const EGFR_PARAM_DESCRIPTIONS = {
  age: "Required. Age in years (adults 18 to 120). Ask the user if it was not stated; do not guess.",
  sex: "Required. \"male\" or \"female\", as used by the 2021 CKD-EPI creatinine equation. Ask the user if it was not stated; do not guess.",
  creatinine: "Required. Serum creatinine exactly as the user stated it, in the unit given by creatinineUnit (mg/dL up to 50, umol/L up to 4420). Do not convert it yourself.",
  creatinineUnit: "Required. The unit of the serum creatinine value exactly as provided by the user. Use mg/dL for mg/dL or umol/L for µmol/L. Do not convert the value yourself."
} as const;
