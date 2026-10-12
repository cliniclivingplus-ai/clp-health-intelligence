export const extendedSamples: Record<string, Record<string, unknown>> = {
  "calculate_calories": {
    "age": 35,
    "sex": "male",
    "weightKg": 70,
    "heightCm": 170,
    "activityFactor": 1.4,
    "proteinReferenceWeightKg": 65,
    "isPregnant": false,
    "isBreastfeeding": false,
    "needsSpecialistNutrition": false
  },
  "calculate_ovulation": {
    "age": 30,
    "lmp": "2026-10-01",
    "cycleLengthDays": 28,
    "regularCycles": true,
    "isPregnant": false,
    "usesHormonalContraception": false,
    "monthsTrying": 2
  },
  "calculate_due_date": {
    "method": "ivf",
    "transferDate": "2026-10-01",
    "embryoAgeDays": 5
  },
  "calculate_fib4": {
    "age": 50,
    "astUL": 30,
    "altUL": 40,
    "platelets109L": 200,
    "acutelyIll": false,
    "masldContext": true
  },
  "check_metabolic_syndrome": {
    "age": 40,
    "sex": "male",
    "waistCm": 90,
    "triglyceridesMgDl": 150,
    "hdlMgDl": 40,
    "systolicMmHg": 130,
    "diastolicMmHg": 80,
    "fastingGlucoseMgDl": 99,
    "fastingSample": true,
    "treatedHighTriglycerides": false,
    "treatedLowHdl": false,
    "treatedHypertension": false,
    "treatedHighGlucose": false,
    "isPregnant": false
  },
  "calculate_body_fat": {
    "age": 35,
    "sex": "male",
    "heightCm": 175,
    "neckCm": 38,
    "circumferenceCm": 90,
    "isPregnant": false
  },
  "calculate_waist_height": {
    "age": 35,
    "waistCm": 85,
    "heightCm": 170,
    "weightKg": 70,
    "isPregnant": false
  },
  "calculate_heart_rate_zones": {
    "age": 40,
    "heartRateAffectingMedication": false,
    "heartCondition": false,
    "exerciseSymptoms": false,
    "isPregnant": false,
    "restingBpm": 60
  },
  "calculate_pack_years": {
    "age": 55,
    "cigarettesPerDay": 20,
    "yearsSmoked": 25,
    "currentlySmoking": false,
    "yearsSinceQuit": 10
  },
  "assess_burnout": {
    "personal": [
      50,
      50,
      50,
      50,
      50,
      50
    ],
    "work": [
      50,
      50,
      50,
      50,
      50,
      50,
      100
    ]
  },
  "calculate_phenoage": {
    "age": 50,
    "albuminGL": 43,
    "creatinineUmolL": 80,
    "glucoseMmolL": 5,
    "crpMgL": 1,
    "lymphocytePercent": 30,
    "mcvFL": 90,
    "rdwPercent": 13,
    "alkalinePhosphataseUL": 70,
    "wbc109L": 6
  },
  "check_pcos_symptoms": {
    "age": 25,
    "yearsSinceMenarche": 12,
    "shortestCycleDays": 40,
    "longestCycleDays": 60,
    "cyclesPerYear": 6,
    "excessCoarseHair": true,
    "clinicianConfirmedHighAndrogens": false,
    "acneOrHairThinning": false,
    "rapidVirilisation": false,
    "usesHormonalContraception": false,
    "isPregnant": false
  },
  "check_thyroid_symptoms": {
    "age": 35,
    "fatigue": true,
    "coldIntolerance": true,
    "constipation": false,
    "drySkin": false,
    "unexplainedWeightChange": false,
    "heatIntolerance": false,
    "palpitations": false,
    "neckSwelling": false,
    "severeCurrentSymptoms": false,
    "isPregnant": false,
    "knownThyroidDisease": false
  },
  "assess_gut_symptoms": {
    "age": 30,
    "symptomMonths": 8,
    "abdominalPain": true,
    "painRelatedToDefecation": true,
    "changedStoolFrequency": true,
    "changedStoolForm": true,
    "bloating": true,
    "heartburn": false,
    "bloodInStool": false,
    "unintentionalWeightLoss": false,
    "knownAnaemia": false,
    "difficultySwallowing": false,
    "persistentVomiting": false,
    "familyHistoryBowelCancerOrIbd": false,
    "severeCurrentSymptoms": false
  },
  "assess_weight_loss_medication": {
    "age": 40,
    "weightKg": 90,
    "heightCm": 170,
    "weightRelatedCondition": "yes",
    "isPregnant": false,
    "isBreastfeeding": false,
    "planningPregnancy": false,
    "personalOrFamilyMtcOrMen2": false,
    "historyPancreatitis": false,
    "gallbladderDisease": false,
    "eatingDisorder": false
  }
};
