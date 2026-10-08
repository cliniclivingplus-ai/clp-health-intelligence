import test from "node:test";
import assert from "node:assert/strict";
import { calculateEgfr } from "../src/tools/egfr/calculator.js";
import { egfrInputSchema, egfrOutputSchema } from "../src/tools/egfr/schema.js";

 test("45-year-old male with creatinine 1.5 mg/dL returns eGFR 58 / G3a", () => {
  const result = calculateEgfr({ age: 45, sex: "male", creatinine: 1.5, creatinineUnit: "mg/dL" });
  assert.equal(result.egfr, 58);
  assert.equal(result.category, "G3a");
  assert.equal(result.raceCoefficientUsed, false);
});

test("female calculation uses the female coefficient", () => {
  const result = calculateEgfr({ age: 45, sex: "female", creatinine: 1.5, creatinineUnit: "mg/dL" });
  assert.equal(result.egfr, 44);
  assert.equal(result.category, "G3b");
});

test("accepts creatinine in umol/L", () => {
  const mg = calculateEgfr({ age: 45, sex: "male", creatinine: 1.5, creatinineUnit: "mg/dL" });
  const si = calculateEgfr({ age: 45, sex: "male", creatinine: 132.6, creatinineUnit: "umol/L" });
  assert.equal(si.egfr, mg.egfr);
});

test("rejects pediatric age at schema level", () => {
  const parsed = egfrInputSchema.safeParse({ age: 17, sex: "female", creatinine: 1, creatinineUnit: "mg/dL" });
  assert.equal(parsed.success, false);
});

test("rejects non-positive creatinine at schema level", () => {
  const parsed = egfrInputSchema.safeParse({ age: 50, sex: "male", creatinine: 0, creatinineUnit: "mg/dL" });
  assert.equal(parsed.success, false);
});

test("output matches the public schema", () => {
  const result = calculateEgfr({ age: 45, sex: "male", creatinine: 1.5, creatinineUnit: "mg/dL" });
  assert.equal(egfrOutputSchema.safeParse(result).success, true);
});

test("schema accepts typical umol/L creatinine and rejects out-of-range values per unit", () => {
  assert.equal(egfrInputSchema.safeParse({ age: 45, sex: "male", creatinine: 132.6, creatinineUnit: "umol/L" }).success, true);
  assert.equal(egfrInputSchema.safeParse({ age: 45, sex: "male", creatinine: 132.6, creatinineUnit: "mg/dL" }).success, false);
  assert.equal(egfrInputSchema.safeParse({ age: 45, sex: "male", creatinine: 5000, creatinineUnit: "umol/L" }).success, false);
});
