import * as z from "zod/v4";
import { EGFR_PARAM_DESCRIPTIONS as P } from "./metadata.js";

const MAX_CREATININE_MG_DL = 50;
const MAX_CREATININE_UMOL_L = 4420; // 50 mg/dL x 88.4

export const egfrInputSchema = z.object({
  age: z.number().int().min(18).max(120).describe(P.age),
  sex: z.enum(["male", "female"]).describe(P.sex),
  creatinine: z.number().positive().describe(P.creatinine),
  creatinineUnit: z.enum(["mg/dL", "umol/L"]).default("mg/dL").describe(P.creatinineUnit)
}).refine(
  (v) => v.creatinine <= (v.creatinineUnit === "umol/L" ? MAX_CREATININE_UMOL_L : MAX_CREATININE_MG_DL),
  { message: "Creatinine is out of range for the selected unit.", path: ["creatinine"] }
);

export const egfrOutputSchema = z.object({
  tool: z.literal("calculate_egfr"),
  toolVersion: z.string(),
  egfr: z.number(),
  unit: z.literal("mL/min/1.73m²"),
  category: z.enum(["G1", "G2", "G3a", "G3b", "G4", "G5"]),
  categoryDescription: z.string(),
  creatinineMgDl: z.number(),
  raceCoefficientUsed: z.literal(false),
  severity: z.enum(["normal", "follow_up", "concerning", "urgent"]),
  guidance: z.string(),
  cta: z.object({
    show: z.boolean(),
    type: z.literal("consultation").optional(),
    label: z.string().optional(),
    url: z.string().optional()
  }),
  clinicalNote: z.string(),
  disclaimer: z.string()
});

export type EgfrInput = z.infer<typeof egfrInputSchema>;
export type EgfrOutput = z.infer<typeof egfrOutputSchema>;
