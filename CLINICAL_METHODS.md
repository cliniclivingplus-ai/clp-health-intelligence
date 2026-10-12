# Clinical methods — eighteen health tools

These are tested software implementations. Clinical sign-off is pending; no
calculator establishes a diagnosis. Source verification: 11 October 2026.

Tools 4–18 use `src/tools/extended.ts`; tools 1–3 use `src/tools/metabolic.ts`.
`src/tools/registry.ts` is shared by the website API and MCP. All result cards include
primary references, assumptions and limitations. Classifications use unrounded
values, with units enforced by input schemas. The implementation is deterministic;
no language model generates the numerical answer or an invented risk score.

## Additional tools: implementation decisions

| Page | Tool | Scientific method and limits |
|---|---|---|
| `/tool4` | Calorie | Mifflin–St Jeor: 10kg + 6.25cm − 5age +5 male / −161 female. Healthy adults 19–78, outside pregnancy/lactation. Maintenance = resting estimate × explicitly entered activity factor. ICMR-NIN protein reference 0.83 g/kg of a separately entered healthy reference weight, with protein-quality caveat. No calorie deficit prescription. |
| `/tool5` | Ovulation | Estimated next menses = LMP + cycle length; ovulation ≈ next menses −14 days; six-day window ends on that date. Prediction withheld if irregular or outside FIGO 24–38 days. ASRM referral advice uses age and months trying; cycles <25 days warrant earlier evaluation. Not contraception. |
| `/tool6` | Due date | LMP +280, known conception +266, day-3 transfer +263, day-5 transfer +261; ultrasound date +280 − scan gestational days. ACOG discrepancies are strictly greater than 5/7/7/10/14/21 days at <9, 9–13+6, 14–15+6, 16–21+6, 22–27+6 and ≥28 weeks. Does not automatically redate; ART dating takes precedence. Strict real-date validation and UTC calendar arithmetic. |
| `/tool7` | FIB-4 | Age×AST/(platelets×√ALT). AASLD metabolic fatty liver interpretation: low <1.3, lower threshold 2.0 above age 65, high ≥2.67 using the guidance's table band. Do not apply during acute illness or assume generic hepatitis staging. Under35 risk interpretation is withheld. Not a fibrosis stage. |
| `/tool8` | Metabolic syndrome | Any3 of5: waist ≥90/80cm male/female; TG ≥150mg/dL; HDL <40/50; BP ≥130 systolic or ≥85 diastolic; fasting glucose ≥100mg/dL. Relevant treatment counts for the specific abnormality. South Asian adult, non-pregnant assessment. Markedly abnormal BP or low glucose triggers clinical attention independently of the component count. |
| `/tool9` | Body fat | Historical Navy regression, log10 with inches converted from cm. Men: 86.010log(abdomen−neck) −70.041log(height)+36.76; women: 163.205log(waist+hip−neck)−97.684log(height)−78.387. Different measurement sites explained. Implausible estimates rejected rather than clamped. 2025 Indian >25.5%/>38% comparison is approximate; Navy estimates are not validated Indian diagnostic staging. |
| `/tool10` | Waist/height | NICE0.4–<0.5 healthy central-adiposity band, 0.5–<0.6 increased, ≥0.6 high; interpretation withheld at BMI≥35. Below0.4 is not automatically called healthy or diagnosed underweight. |
| `/tool11` | Heart rate | Tanaka208−0.7age (18–81). ACSM HRmax moderate64–76%, vigorous77–95%; optional HRreserve moderate40–59%, vigorous60–89%. Separate methods labelled. Ranges withheld with relevant medication, cardiac history, exercise symptoms or pregnancy. No exercise clearance or five invented physiological zones. |
| `/tool12` | Smoking | Average cigarettes/day÷20×total smoking years; excludes non-cigarette equivalence. USPSTF2021 age50–80, ≥20pack-years, current smoking or quit<15years. US recommendation, subject to clinician confirmation and local context. WHO cessation milestones are population-level information. |
| `/tool13` | Burnout | Original CBI6 personal, optional7 work and6 client questions; each domain averaged separately. Work item7 reverse-scored. Frequency/degree options match original item types. All selected-domain responses required; no missing-answer imputation, combined score or universal diagnostic severity bands. NFA permits commercial/noncommercial use with Borritz2006 attribution, included in results. |
| `/tool14` | Phenotypic age | Clinical blood-marker model, not DNAm. Primary printed TableS1 coefficients: constant−19.9067, albumin−0.0336g/L, creatinine0.0095µmol/L, glucose0.1953mmol/L, ln(CRPmg/dL)0.0954, lymphocyte%−0.0120, MCV0.0268fL, RDW0.3306%, ALP0.0019U/L, WBC0.0554×10⁹/L, age0.0804. CRP inputmg/L divided by10 before natural log. γ0.0076927 from methods. Algebraic log-hazard form avoids CDF saturation. Published-coefficient precision stated; raw age difference is not residual PhenoAge acceleration. No lifespan prediction or India-specific calibration claim. |
| `/tool15` | PCOS | Guideline2023 irregular-cycle definitions depend on years after menarche. Reported hirsutism/confirmed androgen elevation prompts assessment; acne/scalp hair loss alone does not confirm hyperandrogenism. Pregnancy/contraception limits interpretation. Adolescent criteria and ultrasound/AMH restrictions explained. No diagnosis, ultrasound interpretation or probability. |
| `/tool16` | Thyroid | Nonspecific symptoms, neck swelling and urgent symptoms guide examination/testing discussions. TSH/freeT4 require laboratory and clinical context; no made-up symptom score or conversion of Indian population prevalence to an individual probability. |
| `/tool17` | Gut | BSG/NICE assessment prompts, warning signs override bowel-pattern suggestions. Not a complete NICE/RomeIV diagnostic algorithm or microbiome/IBS score. Coeliac testing discussion and continuing gluten before testing explained. Reflux and bowel symptoms are distinguished. |
| `/tool18` | Weight-loss medicines | CDSCOCT-18 semaglutide indication comparison: BMI≥30 or ≥27 with confirmed weight-related comorbidity. Exact Indian product label must be verified by prescriber. WHO2025 adult obesity scope≥30, conditional recommendation, excluding pregnancy. Indian obesity BMI23/25 does not substitute for medicine-label thresholds. Pregnancy, lactation/planning and other histories trigger clinical review; no eligibility certificate, drug choice or dose. |

The primary URLs are kept with each implementation and shown in every result.
This file describes implemented choices; it is not an assertion of clinical approval.
Automated boundary and independent formula checks are in `tests/extended.test.ts`.
Website/MCP parity, schemas and card resources are checked in `tests/health-pages.test.ts`.

## BMI for Indian adults — `/tool1`, `calculate_bmi`

BMI = weight (kg) / height (m)². Conventional Indian BMI bands: underweight <18.5,
normal 18.5–<23, overweight 23–<25, obesity ≥25. Category decisions use the
unrounded value; the displayed BMI is rounded to two decimals.

The optional 2025 India Obesity Commission screen is separate from these bands.
It uses BMI >23 and central adiposity (waist ≥90 cm for males or ≥80 cm for females,
or waist-to-height ratio >0.5). A Stage 2 pattern additionally requires an
obesity-related comorbidity or limitation in daily activities. Stage 1 is only
reported as a provisional pattern when both health-effect answers are explicitly
"no". Uncertain/missing answers do not establish absence of disease. BMI alone
never determines stage; clinician confirmation is required. Body-fat-based
exceptions below BMI 23 are not assessed by this implementation.

Sources:
- [ESI clinical practice guidelines, 2022](https://www.endocrinesocietyindia.org/esi_images/task_force/OBESITY.pdf)
- [Misra et al., 2025, DOI 10.1016/j.dsx.2024.102989](https://doi.org/10.1016/j.dsx.2024.102989)

## HbA1c to estimated average glucose — `/tool2`, `calculate_hba1c`

ADAG equation: eAG (mg/dL) = 28.7 × laboratory HbA1c (%) − 46.7.
Convert to mmol/L by dividing the unrounded result by 18.0182. Display both to
one decimal. Accept percentages 4–20; values above 12 include an extrapolation
note. IFCC mmol/mol inputs are not accepted. This implementation provides no
diabetes diagnosis, treatment target, or medication adjustment. Severity is
"informational", which does not imply a normal glucose result.

Sources:
- [ADA conversion calculator](https://professional.diabetes.org/glucose_calc)
- [Nathan et al., ADAG study, 2008](https://doi.org/10.2337/dc08-0545)

## Original IDRS — `/tool3`, `calculate_idrs`

The implementation follows the original Mohan 2005 paper, not a later four-level
activity variant. Age points: <35 = 0; 35–49 = 20; ≥50 = 30. Waist points:
female <80 / 80–<90 / ≥90 cm, male <90 / 90–<100 / ≥100 cm = 0 / 10 / 20.
Activity points: regular exercise AND strenuous work = 0; either = 20; neither = 30.
Parental diabetes points: neither / one / both = 0 / 10 / 20.

Low score <30, moderate 30–<60, high ≥60; maximum 100. Eligibility: Indian adults
20+ without previously diagnosed diabetes, outside pregnancy screening. The
original study's enrolment started at age 20. A score is neither a probability
nor a 10-year risk estimate. Low scores do not rule out diabetes.

Sources:
- [Mohan et al., 2005, JAPI 53:759–763](https://pubmed.ncbi.nlm.nih.gov/16334618/)
- [Author-uploaded original paper, Table 1 and Table 2](https://www.researchgate.net/publication/7434301_A_simplified_Indian_Diabetes_Risk_Score_for_screening_for_undiagnosed_diabetic_subjects)
- [MDRF research tools](https://mdrf.in/research-tools-instruments/)

## Validation and implementation limits

Tests include published reference examples, threshold boundaries, unrounded BMI
classification, staging with missing information, applicability rejection, MCP
discovery and resource delivery, website/MCP parity and excluded health-input logs.
Frontend scripts render server output and contain no clinical calculations.
API and MCP use the same calculation functions and schemas.

Measurement limits are application input guards, not reference ranges. No clinical
reviewer has signed off the code or wording. Consultation links appear only when
the server supplies an approved `CLP_CONSULTATION_URL` and the result policy allows it.
