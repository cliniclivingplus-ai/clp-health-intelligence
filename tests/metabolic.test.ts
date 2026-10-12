import test from "node:test";
import assert from "node:assert/strict";
import { calculateBmi, calculateHba1c, calculateIdrs, bmiInputSchema, hba1cInputSchema, idrsInputSchema } from "../src/tools/metabolic.js";

const bmiBase = { age: 35, weightKg: 70, heightCm: 170, isPregnant: false as const };
const idrsBase = { age: 45, sex: "male" as const, waistCm: 92, regularExercise: true,
  strenuousWork: false, parentsWithDiabetes: 1, knownDiabetes: false as const, isPregnant: false as const };

test("BMI uses metric formula and conventional Indian cut-offs without classifying rounded results", () => {
  assert.equal(calculateBmi(bmiBase).bmi, 24.22);
  for (const [raw, category] of [[18.49, "underweight"], [18.5, "normal"], [22.999, "normal"],
    [23, "overweight"], [24.999, "overweight"], [25, "obesity"]] as const) {
    assert.equal(calculateBmi({ ...bmiBase, heightCm: 200, weightKg: raw * 4 }).bmiCategory, category);
  }
});

test("2025 obesity stage is not inferred from BMI alone", () => {
  assert.equal(calculateBmi({ ...bmiBase, weightKg: 90 }).stage, "not_assessed");
  assert.equal(calculateBmi({ ...bmiBase, weightKg: 90, obesityRelatedCondition: "unknown", functionalLimitation: "no" }).stage, "not_assessed");
  assert.equal(calculateBmi({ ...bmiBase, obesityRelatedCondition: "no", functionalLimitation: "no" }).stage, "stage_1_screen");
});

test("stage 2 requires BMI >23, central adiposity and at least one health effect", () => {
  const input = { ...bmiBase, waistCm: 90, sex: "male" as const, obesityRelatedCondition: "yes" as const };
  assert.equal(calculateBmi(input).stage, "stage_2_screen");
  assert.equal(calculateBmi({ ...input, heightCm: 200, weightKg: 92 }).stage, "not_assessed"); // exactly 23
  assert.equal(calculateBmi({ ...input, waistCm: 75 }).stage, "clinical_review_needed");
  assert.equal(calculateBmi({ ...input, waistCm: undefined }).stage, "not_assessed");
  assert.equal(calculateBmi({ ...input, obesityRelatedCondition: "no", functionalLimitation: "yes" }).stage, "stage_2_screen");
});

test("central adiposity respects sex-specific waist limits and strict waist-height ratio >0.5", () => {
  const input = { ...bmiBase, heightCm: 200, weightKg: 100, waistCm: 80, sex: "female" as const };
  assert.equal(calculateBmi(input).centralAdiposity, true);
  assert.equal(calculateBmi({ ...input, sex: "male" }).centralAdiposity, false);
  assert.equal(calculateBmi({ ...input, sex: undefined }).centralAdiposity, undefined);
  assert.equal(calculateBmi({ ...input, sex: undefined, waistCm: 101 }).centralAdiposity, true);
  assert.equal(calculateBmi({ ...input, sex: undefined, waistCm: 100 }).centralAdiposity, undefined);
});

test("BMI rejects minors, pregnancy, missing applicability and invalid measurements", () => {
  for (const patch of [{ age: 17 }, { isPregnant: true }, { isPregnant: undefined }, { weightKg: 0 }, { heightCm: 0 }]) {
    assert.equal(bmiInputSchema.safeParse({ ...bmiBase, ...patch }).success, false);
  }
});

test("ADAG published reference values convert with full precision before rounding", () => {
  for (const [a1c, expected] of [[5, 96.8], [6, 125.5], [7, 154.2], [8, 182.9], [10, 240.3]]) {
    const result = calculateHba1c({ hba1cPercent: a1c });
    assert.equal(result.eagMgDl, expected);
    assert.equal(result.eagMmolL, Number((expected / 18.0182).toFixed(1)));
    assert.equal(result.severity, "informational");
    assert.equal(result.cta.show, false);
  }
});

test("HbA1c rejects glucose / IFCC-style values and flags extrapolated estimates", () => {
  assert.equal(hba1cInputSchema.safeParse({ hba1cPercent: 53 }).success, false);
  assert.equal(hba1cInputSchema.safeParse({ hba1cPercent: -1 }).success, false);
  assert.ok(calculateHba1c({ hba1cPercent: 13 }).limitations.some((text) => text.includes("extrapolated")));
});

test("original Mohan 2005 paper examples reproduce scores 60, 90 and 0", () => {
  assert.equal(calculateIdrs(idrsBase).score, 60);
  assert.equal(calculateIdrs({ ...idrsBase, age: 60, waistCm: 101, parentsWithDiabetes: 2 }).score, 90);
  assert.equal(calculateIdrs({ ...idrsBase, age: 25, waistCm: 80, parentsWithDiabetes: 0, strenuousWork: true }).score, 0);
});

test("IDRS age and waist boundaries, original activity AND/OR and parental points", () => {
  assert.equal(calculateIdrs({ ...idrsBase, age: 34 }).components.age, 0);
  assert.equal(calculateIdrs({ ...idrsBase, age: 35 }).components.age, 20);
  assert.equal(calculateIdrs({ ...idrsBase, age: 50 }).components.age, 30);
  for (const sex of ["male", "female"] as const) {
    const lower = sex === "male" ? 90 : 80;
    for (const [waistCm, points] of [[lower - 0.1, 0], [lower, 10], [lower + 9.9, 10], [lower + 10, 20]]) {
      assert.equal(calculateIdrs({ ...idrsBase, sex, waistCm }).components.waist, points);
    }
  }
  for (const [exercise, work, points] of [[true, true, 0], [true, false, 20], [false, true, 20], [false, false, 30]] as const) {
    assert.equal(calculateIdrs({ ...idrsBase, regularExercise: exercise, strenuousWork: work }).components.activity, points);
  }
  for (const parents of [0, 1, 2]) assert.equal(calculateIdrs({ ...idrsBase, parentsWithDiabetes: parents }).components.family, parents * 10);
});

test("IDRS screens low <30, moderate 30–59 and high >=60, up to 100", () => {
  assert.equal(calculateIdrs({ ...idrsBase, age: 25, waistCm: 80, parentsWithDiabetes: 0 }).risk, "low");
  assert.equal(calculateIdrs({ ...idrsBase, age: 25, waistCm: 80, parentsWithDiabetes: 0, regularExercise: false }).risk, "moderate");
  assert.equal(calculateIdrs({ ...idrsBase, parentsWithDiabetes: 0 }).score, 50);
  assert.equal(calculateIdrs({ ...idrsBase, parentsWithDiabetes: 0 }).risk, "moderate");
  assert.equal(calculateIdrs(idrsBase).risk, "high");
  assert.equal(calculateIdrs({ ...idrsBase, age: 50, waistCm: 100, regularExercise: false, parentsWithDiabetes: 2 }).score, 100);
});

test("IDRS rejects age <20, known diabetes, pregnancy and missing questionnaire answers", () => {
  for (const patch of [{ age: 19 }, { knownDiabetes: true }, { knownDiabetes: undefined },
    { isPregnant: true }, { regularExercise: undefined }, { parentsWithDiabetes: 3 }]) {
    assert.equal(idrsInputSchema.safeParse({ ...idrsBase, ...patch }).success, false);
  }
});
