import * as z from "zod/v4";

const disclaimer = "Educational screening result only. A calculator cannot diagnose disease or replace a healthcare professional's assessment.";
const reference = z.object({ title: z.string(), url: z.string() });
const common = {
  tool: z.string(), toolVersion: z.literal("1.0.0"), title: z.string(),
  displayValue: z.string(), unit: z.string(), category: z.string(),
  severity: z.enum(["informational", "normal", "follow_up", "concerning"]), guidance: z.string(),
  details: z.array(z.object({ label: z.string(), value: z.string() })),
  limitations: z.array(z.string()), references: z.array(reference), disclaimer: z.string(),
  cta: z.object({ show: z.boolean(), label: z.string().optional(), url: z.string().optional() })
};
export const metabolicOutputSchema = z.object(common);
export type MetabolicResult = z.infer<typeof metabolicOutputSchema>;
const cta = (show: boolean) => show ? { show, label: "Consult Clinic Living Plus" } : { show };
const age = z.number().int().min(18).max(120).describe("Age in completed years. Adult-only; ask if missing.");
const sex = z.enum(["male", "female"]).describe("Sex used for waist thresholds; ask if missing, never guess.");

export const bmiInputSchema = z.object({
  age,
  weightKg: z.number().min(20).max(500).describe("Weight in kilograms. Convert only if the original unit is known."),
  heightCm: z.number().min(100).max(250).describe("Height in centimetres. Ask for the unit if missing."),
  isPregnant: z.literal(false).describe("Confirm this is not a pregnancy assessment. Pregnancy BMI interpretation is outside this tool."),
  sex: sex.optional(),
  waistCm: z.number().min(30).max(250).optional().describe("Optional waist circumference in centimetres for the 2025 staging screen."),
  obesityRelatedCondition: z.enum(["yes", "no", "unknown"]).optional().describe("Clinician-identified obesity-related condition, such as diabetes, hypertension, sleep apnoea or fatty liver. Do not infer from BMI."),
  functionalLimitation: z.enum(["yes", "no", "unknown"]).optional().describe("Obesity-associated limitation in daily activities; do not assume its cause from symptoms alone.")
});
export const bmiOutputSchema = metabolicOutputSchema.extend({
  tool: z.literal("calculate_bmi"), bmi: z.number(),
  bmiCategory: z.enum(["underweight", "normal", "overweight", "obesity"]),
  stage: z.enum(["not_assessed", "stage_1_screen", "stage_2_screen", "clinical_review_needed"]),
  waistHeightRatio: z.number().optional(), centralAdiposity: z.boolean().optional()
});
export function calculateBmi(input: z.input<typeof bmiInputSchema>) {
  const p = bmiInputSchema.parse(input);
  const raw = p.weightKg / (p.heightCm / 100) ** 2;
  const bmi = Number(raw.toFixed(2));
  const bmiCategory = raw < 18.5 ? "underweight" : raw < 23 ? "normal" : raw < 25 ? "overweight" : "obesity";
  const ratio = p.waistCm === undefined ? undefined : p.waistCm / p.heightCm;
  const central = ratio === undefined ? undefined : ratio > 0.5 ||
    (p.sex === undefined ? false : p.waistCm! >= (p.sex === "male" ? 90 : 80));
  // Without sex, a ratio <= 0.5 cannot rule out the sex-specific waist criterion.
  const centralKnown = ratio !== undefined && (ratio > 0.5 || p.sex !== undefined);
  const impact = p.obesityRelatedCondition === "yes" || p.functionalLimitation === "yes";
  const noImpact = p.obesityRelatedCondition === "no" && p.functionalLimitation === "no";
  let stage: z.infer<typeof bmiOutputSchema>["stage"] = "not_assessed";
  if (raw > 23) {
    if (central === true && impact) stage = "stage_2_screen";
    else if (noImpact) stage = "stage_1_screen";
    else if (impact && centralKnown && central === false) stage = "clinical_review_needed";
  }
  const stageText = { not_assessed: raw <= 23 ? "BMI >23 staging criterion not met; clinical context still matters" : "More information needed to assess stage",
    stage_1_screen: "Stage 1 pattern — clinician confirmation needed",
    stage_2_screen: "Stage 2 pattern — clinician confirmation needed",
    clinical_review_needed: "Clinical review needed; staging criteria are incomplete" }[stage];
  return bmiOutputSchema.parse({ tool: "calculate_bmi", toolVersion: "1.0.0", title: "BMI for Indian adults",
    displayValue: bmi.toFixed(2), unit: "kg/m²", category: bmiCategory[0].toUpperCase() + bmiCategory.slice(1),
    bmi, bmiCategory, stage, waistHeightRatio: ratio === undefined ? undefined : Number(ratio.toFixed(3)),
    centralAdiposity: centralKnown ? central : undefined,
    severity: stage === "stage_2_screen" ? "concerning" : bmiCategory === "normal" ? "normal" : "follow_up",
    guidance: bmiCategory === "normal" ? "Your BMI falls within the conventional Indian adult reference range. Waist size and metabolic health still matter."
      : "Discuss this result alongside waist measurements, blood pressure, blood tests and daily functioning with a healthcare professional.",
    details: [{ label: "Indian BMI category", value: bmiCategory }, { label: "2025 obesity staging screen", value: stageText },
      ...(ratio === undefined ? [] : [{ label: "Waist-to-height ratio", value: ratio.toFixed(3) }])],
    limitations: ["BMI does not directly measure body fat. Muscularity, fluid retention and body composition can affect interpretation.",
      "Adult, non-pregnant assessment only. The 2025 staging screen uses BMI >23, central adiposity and clinician-attributed health effects. Self-reported absence of conditions cannot confirm normal organ function.",
      "Conventional BMI bands (18.5, 23 and 25) and the 2025 obesity stages describe different aspects of assessment; a stage is not determined by BMI alone."],
    references: [{ title: "ESI clinical practice guidelines, 2022 — Indian BMI bands", url: "https://www.endocrinesocietyindia.org/esi_images/task_force/OBESITY.pdf" },
      { title: "India Obesity Commission, 2025 — revised definition and staging", url: "https://doi.org/10.1016/j.dsx.2024.102989" }], disclaimer, cta: cta(bmiCategory !== "normal" || stage === "stage_2_screen") });
}

export const hba1cInputSchema = z.object({
  hba1cPercent: z.number().min(4).max(20).describe("Laboratory HbA1c in percent (4–20%). Require the % unit; do not pass IFCC mmol/mol or a glucose reading.")
});
export const hba1cOutputSchema = metabolicOutputSchema.extend({ tool: z.literal("calculate_hba1c"),
  hba1cPercent: z.number(), eagMgDl: z.number(), eagMmolL: z.number() });
export function calculateHba1c(input: z.input<typeof hba1cInputSchema>) {
  const p = hba1cInputSchema.parse(input);
  const raw = 28.7 * p.hba1cPercent - 46.7;
  const eagMgDl = Number(raw.toFixed(1));
  const eagMmolL = Number((raw / 18.0182).toFixed(1));
  return hba1cOutputSchema.parse({ tool: "calculate_hba1c", toolVersion: "1.0.0", title: "HbA1c to average blood sugar",
    hba1cPercent: p.hba1cPercent, eagMgDl, eagMmolL, displayValue: eagMgDl.toFixed(1), unit: "mg/dL",
    category: "Estimated average glucose", severity: "informational",
    guidance: "This estimates average glucose over roughly the past 2–3 months. It is not today's glucose reading or a treatment target. Review your laboratory HbA1c with your healthcare professional.",
    details: [{ label: "Laboratory HbA1c", value: `${p.hba1cPercent}%` }, { label: "Average glucose in mmol/L", value: `${eagMmolL.toFixed(1)} mmol/L` }],
    limitations: ["The ADAG relationship is a population estimate; your measured glucose average may differ.",
      "Anaemia, altered red-cell lifespan, recent blood loss or transfusion, haemoglobin variants, pregnancy and some kidney conditions may affect HbA1c reliability.",
      ...(p.hba1cPercent > 12 ? ["This HbA1c is beyond the usual 4–12% ADAG conversion table; the result is an extrapolated estimate. Review it with your clinician."] : []),
      "This conversion does not diagnose diabetes or recommend changes to medicines."],
    references: [{ title: "American Diabetes Association — ADAG conversion", url: "https://professional.diabetes.org/glucose_calc" },
      { title: "Nathan et al., 2008 — ADAG study", url: "https://doi.org/10.2337/dc08-0545" }], disclaimer, cta: cta(false) });
}

export const idrsInputSchema = z.object({
  age: age.min(20).describe("Age in completed years, 20–120. The original IDRS study enrolled adults aged 20 and above."),
  sex,
  waistCm: z.number().min(30).max(250).describe("Waist circumference in centimetres; do not substitute BMI."),
  regularExercise: z.boolean().describe("Does the person exercise regularly? Ask, never assume."),
  strenuousWork: z.boolean().describe("Does work involve strenuous physical activity? Ask, never assume."),
  parentsWithDiabetes: z.number().int().min(0).max(2).describe("Number of parents known to have diabetes: 0, 1 or 2. Unknown history must be clarified."),
  knownDiabetes: z.literal(false).describe("Confirm no prior diabetes diagnosis. IDRS screens for undiagnosed diabetes; it is not a monitoring tool."),
  isPregnant: z.literal(false).describe("Confirm this is not pregnancy-specific diabetes screening.")
});
export const idrsOutputSchema = metabolicOutputSchema.extend({ tool: z.literal("calculate_idrs"),
  score: z.number().int().min(0).max(100), risk: z.enum(["low", "moderate", "high"]),
  components: z.object({ age: z.number(), waist: z.number(), activity: z.number(), family: z.number() }) });
export function calculateIdrs(input: z.input<typeof idrsInputSchema>) {
  const p = idrsInputSchema.parse(input);
  const ageScore = p.age < 35 ? 0 : p.age < 50 ? 20 : 30;
  const lower = p.sex === "male" ? 90 : 80;
  const waist = p.waistCm < lower ? 0 : p.waistCm < lower + 10 ? 10 : 20;
  const activity = p.regularExercise && p.strenuousWork ? 0 : p.regularExercise || p.strenuousWork ? 20 : 30;
  const family = p.parentsWithDiabetes * 10;
  const score = ageScore + waist + activity + family;
  const risk = score < 30 ? "low" : score < 60 ? "moderate" : "high";
  return idrsOutputSchema.parse({ tool: "calculate_idrs", toolVersion: "1.0.0", title: "Indian Diabetes Risk Score",
    score, risk, components: { age: ageScore, waist, activity, family }, displayValue: String(score), unit: "/ 100",
    category: `${risk[0].toUpperCase() + risk.slice(1)} screening risk`, severity: risk === "high" ? "concerning" : risk === "moderate" ? "follow_up" : "normal",
    guidance: risk === "high" ? "Your score meets the high-risk screening threshold. Arrange a blood glucose assessment with a healthcare professional; this score does not mean you have diabetes."
      : risk === "moderate" ? "Discuss whether blood glucose testing is appropriate. The score can support screening decisions alongside symptoms and clinical history."
      : "A low score does not rule out diabetes. Symptoms or other clinical concerns still warrant blood glucose testing.",
    details: [{ label: "Age points", value: String(ageScore) }, { label: "Waist points", value: String(waist) },
      { label: "Activity points", value: String(activity) }, { label: "Family history points", value: String(family) }],
    limitations: ["Original Mohan 2005 IDRS, for screening undiagnosed type 2 diabetes in Indian adults aged 20 and above.",
      "This score is not a probability or a 10-year risk estimate. Do not use it for people with known diabetes or for pregnancy-specific screening.",
      "The original activity points are 0 for regular exercise AND strenuous work, 20 for either, and 30 for neither. Later modified activity scales are not used here."],
    references: [{ title: "Mohan et al., 2005 — original IDRS", url: "https://pubmed.ncbi.nlm.nih.gov/16334618/" },
      { title: "Madras Diabetes Research Foundation — IDRS", url: "https://mdrf.in/research-tools-instruments/" }], disclaimer, cta: cta(risk !== "low") });
}

export const metabolicTools = [
  { name: "calculate_bmi", title: "BMI for Indian adults", slug: "tool1", inputSchema: bmiInputSchema, outputSchema: bmiOutputSchema,
    calculate: calculateBmi, description: "Calculate BMI for Indian non-pregnant adults from age, weightKg and heightCm. Confirm isPregnant:false. Conventional Indian BMI bands plus an optional 2025 India Obesity Commission staging screen. Ask for units and missing required inputs; never infer obesity stage from BMI alone. Optional waist, sex and clinician-attributed health effects support the stage screen. Not a diagnosis." },
  { name: "calculate_hba1c", title: "HbA1c to average blood sugar", slug: "tool2", inputSchema: hba1cInputSchema, outputSchema: hba1cOutputSchema,
    calculate: calculateHba1c, description: "Convert a laboratory HbA1c percentage to estimated average glucose in mg/dL and mmol/L using the ADAG equation (28.7 × HbA1c − 46.7). Require hba1cPercent with confirmed % unit; ask if missing. Do not pass mmol/mol or glucose values. No diabetes diagnosis, medication advice or acute glucose interpretation." },
  { name: "calculate_idrs", title: "Indian Diabetes Risk Score", slug: "tool3", inputSchema: idrsInputSchema, outputSchema: idrsOutputSchema,
    calculate: calculateIdrs, description: "Original Mohan 2005 Indian Diabetes Risk Score for undiagnosed type 2 diabetes screening in Indian adults 20+. Ask for age, sex, waistCm, regularExercise, strenuousWork, parentsWithDiabetes (0–2) and confirm knownDiabetes:false and isPregnant:false; never guess. Score is not a probability, diagnosis or a monitoring tool for known diabetes. Not pregnancy screening." }
] as const;

export function runMetabolicTool(name: string, input: unknown): MetabolicResult {
  switch (name) {
    case "calculate_bmi": return calculateBmi(input as z.input<typeof bmiInputSchema>);
    case "calculate_hba1c": return calculateHba1c(input as z.input<typeof hba1cInputSchema>);
    case "calculate_idrs": return calculateIdrs(input as z.input<typeof idrsInputSchema>);
    default: throw new Error("Unknown health tool.");
  }
}
