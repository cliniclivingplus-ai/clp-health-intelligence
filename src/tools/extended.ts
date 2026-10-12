import * as z from "zod/v4";
import { metabolicOutputSchema, type MetabolicResult } from "./metabolic.js";

// All numerical classification uses unrounded values. Formatting happens afterwards.
export type Field = { name: string; label: string; type: "number" | "select" | "date"; hint?: string;
  min?: number; max?: number; step?: string; optional?: boolean; options?: [string, string][];
  valueType?: "boolean" | "number"; when?: [string, string] };
const num = (name: string, label: string, min: number, max: number, hint = "", optional = false): Field => ({ name, label, type: "number", min, max, hint, optional });
const sel = (name: string, label: string, options: [string, string][], hint = "", optional = false): Field => ({ name, label, type: "select", options, hint, optional });
const bool = (name: string, label: string, hint = ""): Field => ({ ...sel(name, label, [["false", "No"], ["true", "Yes"]], hint), valueType: "boolean" });
const date = (name: string, label: string, optional = false): Field => ({ name, label, type: "date", optional, hint: "Use the calendar date on your record." });
const age = z.number().int().min(18).max(120).describe("Age in completed years; adults only. Ask if missing.");
const sex = z.enum(["male", "female"]).describe("Sex for the published sex-specific equation or thresholds; ask, never infer.");
const weight = z.number().min(20).max(500).describe("Measured weight, kg.");
const height = z.number().min(100).max(250).describe("Measured height, cm.");
const waist = z.number().min(30).max(250).describe("Measured circumference, cm; follow the tool's measurement instructions.");
const noPregnancy = z.literal(false).describe("Confirm not pregnant; this method does not apply in pregnancy.");
const sexField = sel("sex", "Sex used by the published method", [["male", "Male"], ["female", "Female"]]);
const ageField = { ...num("age", "Age · years", 18, 120), step: "1" };
const pregnancyField = bool("isPregnant", "Currently pregnant?");
const round = (n: number, digits = 1) => Math.round((n + Number.EPSILON * Math.abs(n)) * 10 ** digits) / 10 ** digits;
const ref = (title: string, url: string) => ({ title, url });
const ACOG = ref("ACOG — Methods for Estimating the Due Date", "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/05/methods-for-estimating-the-due-date");
const ASRM = ref("ASRM — Optimizing natural fertility (2022)", "https://www.asrm.org/practice-guidance/practice-committee-documents/optimizing-natural-fertility-a-committee-opinion-2021/");
const AASLD = ref("AASLD — NAFLD practice guidance (2023), FIB-4 pathway", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10735173/");
const INDIA = ref("India Obesity Commission (2025) — definition and staging", "https://doi.org/10.1016/j.dsx.2024.102989");
const NICE = ref("NICE NG246 — waist-to-height bands (2022 recommendations)", "https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity");
const CBI = ref("NFA — original Copenhagen Burnout Inventory and scoring", "https://nfa.dk/media/a4wheblj/cbi-scales.pdf");
const PHENO = ref("Levine et al. (2018) — Supplement 1, Table S1 and methods", "https://cdn.aging-us.com/article/101414/supplementary/SD1/0/aging-v10i4-101414-supplementary-material-SD1.pdf");
const PCOS = ref("International PCOS Guideline (2023)", "https://integration.asrm.org/globalassets/_asrm/practice-guidance/practice-guidelines/pdf/recommendations_from_the_2023_int_evidence-based_guideline_on_pcos.pdf");
const THYROID = ref("American Thyroid Association — adult hypothyroidism", "https://www.thyroid.org/hypothyroidism/");
const GUT = ref("BSG — IBS guideline (2021)", "https://gut.bmj.com/content/70/7/1214");
const CG61 = ref("NICE CG61 — IBS assessment", "https://www.nice.org.uk/guidance/cg61/chapter/Recommendations");
const NG20 = ref("NICE NG20 — coeliac disease testing", "https://www.nice.org.uk/guidance/ng20/chapter/Recommendations");
const CDSCO = ref("CDSCO — CT-18 approvals through March 2026, semaglutide indication", "https://www.cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadBiologicalrDNA/CT-18%20Approvals%20Jan%2C%202020%20-%20march%202026.pdf");
const WHO = ref("WHO — GLP-1 obesity guideline (2025)", "https://www.who.int/news/item/01-12-2025-who-issues-global-guideline-on-the-use-of-glp-1-medicines-in-treating-obesity");
function result(tool: string, title: string, displayValue: string, unit: string, category: string, guidance: string,
  details: [string, string][], limitations: string[], references: {title:string;url:string}[], severity: MetabolicResult["severity"] = "informational"): MetabolicResult {
  return metabolicOutputSchema.parse({ tool, toolVersion: "1.0.0", title, displayValue, unit, category, guidance,
    details: details.map(([label, value]) => ({ label, value })), limitations, references, severity,
    disclaimer: "Educational result. Estimates and symptom assessments cannot establish a diagnosis or prescribe treatment. Clinical sign-off of this implementation is pending.",
    cta: { show: severity === "follow_up" || severity === "concerning", label: "Consult Clinic Living Plus" } });
}
function define<S extends z.ZodType>(n: number, name: string, title: string, method: string, intro: string, fields: Field[], schema: S,
  calculate: (p: z.output<S>) => MetabolicResult, example: z.input<S>) {
  return { name, title, slug: `tool${n}`, method, intro, fields, inputSchema: schema, outputSchema: metabolicOutputSchema,
    description: `${intro} Method: ${method}. Require all mandatory inputs with the stated units; ask for missing information and never guess. Educational only; no diagnosis, individual disease probability or prescription. Respect exclusions and limitations returned by the tool.`,
    calculate: (input: unknown) => calculate(schema.parse(input)), example };
}
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(s + "T00:00:00Z"); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Enter a real calendar date in YYYY-MM-DD format.");
const days = (s: string, n: number) => new Date(new Date(s + "T00:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);

const calorieSchema = z.object({ age: age.max(78).min(19), sex, weightKg: weight, heightCm: height, isPregnant: noPregnancy,
  isBreastfeeding: z.literal(false), activityFactor: z.number().min(1.2).max(2.4).describe("Estimated physical activity level, total/resting energy ratio, 1.2–2.4. This is an assumption, not measured expenditure."),
  proteinReferenceWeightKg: weight.describe("Healthy reference weight chosen with a clinician, kg; do not automatically use excess body weight."),
  needsSpecialistNutrition: z.literal(false).describe("Confirm no condition requiring an individual nutrition plan, e.g. kidney disease, acute illness or eating disorder.") });
const calorie = define(4, "calculate_calories", "Calorie calculator", "Mifflin–St Jeor · ICMR-NIN protein reference",
  "Estimate resting energy and maintenance calories for healthy adults aged 19–78. Protein is a healthy-adult reference, with a separately entered reference weight.",
  [{...ageField,min:19,max:78}, sexField, num("weightKg", "Measured weight · kg",20,500),num("heightCm","Height · cm",100,250),
    num("activityFactor","Estimated activity factor",1.2,2.4,"Total daily/resting expenditure ratio. 1.2 represents very little activity; higher values need an informed estimate."),
    num("proteinReferenceWeightKg","Healthy reference weight for protein · kg",20,500,"Use a clinician-agreed healthy reference weight. Do not automatically copy excess body weight."),pregnancyField,
    bool("isBreastfeeding","Currently breastfeeding?"),bool("needsSpecialistNutrition","Kidney disease, eating disorder, acute illness or another condition needing specialist nutrition?")],calorieSchema,p=>{
    const resting=10*p.weightKg+6.25*p.heightCm-5*p.age+(p.sex==="male"?5:-161);
    return result("calculate_calories","Calorie calculator",String(Math.round(resting*p.activityFactor)),"kcal/day","Estimated maintenance energy",
      "Use this as an initial estimate. A dietitian can adjust it using weight trends, health conditions and actual activity. This result does not prescribe a calorie deficit.",
      [["Resting energy estimate",`${Math.round(resting)} kcal/day`],["Equation",`10 × kg + 6.25 × cm − 5 × age ${p.sex==="male"?"+ 5":"− 161"}`],
       ["Assumed activity factor",String(p.activityFactor)],["Healthy-adult protein reference",`${round(0.83*p.proteinReferenceWeightKg)} g/day at 0.83 g/kg`]],
      ["Mifflin–St Jeor predicts resting expenditure, not a measured metabolic rate; the original sample was aged 19–78. Activity factor is a separate estimate.",
       "ICMR-NIN's 0.83 g/kg/day reference assumes adequate protein quality. Predominantly cereal-based diets with poorer protein quality may require about 1 g/kg/day. Pregnancy, lactation, athletes, frailty and clinical illness need individual guidance.",
       "The entered protein reference weight is not automatically calculated from BMI. This is not a kidney-disease protein prescription."],
      [ref("Mifflin et al. (1990) — resting energy equation","https://pubmed.ncbi.nlm.nih.gov/2305711/"),ref("ICMR-NIN — RDA/EAR 2020, revised summary 2024","https://www.nin.res.in/RDA_Full_Report_2024.html")]);
  },{age:35,sex:"male",weightKg:70,heightCm:170,activityFactor:1.4,proteinReferenceWeightKg:65,isPregnant:false,isBreastfeeding:false,needsSpecialistNutrition:false});

const ovulationSchema=z.object({age:age.max(55),lmp:isoDate,cycleLengthDays:z.number().int().min(15).max(90),regularCycles:z.boolean(),
  isPregnant:noPregnancy,usesHormonalContraception:z.literal(false),monthsTrying:z.number().int().min(0).max(120)});
const ovulation=define(5,"calculate_ovulation","Ovulation calculator","Calendar estimate · FIGO · ASRM",
  "Estimate a six-day fertile window from a regular cycle. This method cannot confirm ovulation and must not be used for contraception.",
  [{...ageField,max:55},date("lmp","First day of last menstrual period"),num("cycleLengthDays","Usual cycle length · days",15,90,"First day of one period to first day of the next."),
    bool("regularCycles","Are your cycles usually regular?"),num("monthsTrying","Months trying to conceive",0,120),pregnancyField,bool("usesHormonalContraception","Using hormonal contraception?")],ovulationSchema,p=>{
    const appropriate=p.regularCycles&&p.cycleLengthDays>=24&&p.cycleLengthDays<=38;
    const next=days(p.lmp,p.cycleLengthDays),ov=days(next,-14);
    const review=!appropriate||p.cycleLengthDays<25||p.age>40||p.monthsTrying>=(p.age>=35?6:12);
    return result("calculate_ovulation","Ovulation calculator",appropriate?ov:"Not reliable","",appropriate?"Estimated ovulation date":"Calendar prediction withheld",
      review?"Arrange a fertility assessment. Irregular cycles warrant earlier assessment; ASRM advises evaluation after 12 months under 35, after 6 months at 35+, and more immediately over 40.":"The window is approximate. If trying to conceive, intercourse every 1–2 days during the fertile window can help; consider cervical mucus or urinary LH tracking.",
      appropriate?[["Estimated fertile window",`${days(ov,-5)} to ${ov}`],["Estimated next period",next],["Assumption","Ovulation about 14 days before the next period"]]:[["Reported cycle length",`${p.cycleLengthDays} days`]],
      ["FIGO's usual adult cycle frequency is 24–38 days; this alone does not prove ovulation or regularity.","Luteal length and ovulation timing vary, even with regular cycles. Dates are estimates, not safe days for avoiding pregnancy.","The date entered is cycle day 1. Dates use calendar days without timezone shifts; pregnancy, hormonal contraception and irregular cycles invalidate this simple prediction."],
      [ASRM,ref("ASRM — fertility evaluation (2021)","https://www.asrm.org/practice-guidance/practice-committee-documents/fertility-evaluation-of-infertile-women-a-committee-opinion-2021/"),ref("FIGO — 2018 menstrual terminology revisions","https://doi.org/10.1002/ijgo.12666")],review?"follow_up":"informational");
  },{age:30,lmp:"2026-10-01",cycleLengthDays:28,regularCycles:true,isPregnant:false,usesHormonalContraception:false,monthsTrying:2});

const dueSchema=z.discriminatedUnion("method",[
  z.object({method:z.literal("lmp"),lmp:isoDate}),
  z.object({method:z.literal("conception"),conceptionDate:isoDate}),
  z.object({method:z.literal("ivf"),transferDate:isoDate,embryoAgeDays:z.union([z.literal(3),z.literal(5)])}),
  z.object({method:z.literal("ultrasound"),scanDate:isoDate,scanWeeks:z.number().int().min(5).max(40),scanDays:z.number().int().min(0).max(6),lmp:isoDate.optional()})])
  .refine(p=>p.method!=="ultrasound"||!p.lmp||p.lmp<=p.scanDate,{path:["lmp"],message:"The last menstrual period cannot be later than the ultrasound date."});
const pregnancy=define(6,"calculate_due_date","Pregnancy due date calculator","ACOG · LMP, conception, IVF and scan dating",
  "Calculate an estimated due date from menstrual, conception, embryo-transfer or ultrasound dates. ACOG scan discrepancy thresholds support clinician review.",
  [sel("method","Dating method",[["lmp","Last menstrual period"],["conception","Known conception date"],["ivf","IVF embryo transfer"],["ultrasound","Ultrasound dating"]]),
   {...date("lmp","First day of last menstrual period",true),hint:"Required for LMP dating; optional for comparison with an ultrasound. Leave blank when unknown."},
   {...date("conceptionDate","Known conception date"),when:["method","conception"]},
   {...date("transferDate","Embryo transfer date"),when:["method","ivf"]},
   {...sel("embryoAgeDays","Embryo age at transfer",[["3","Day 3"],["5","Day 5"]]),valueType:"number",when:["method","ivf"]},
   {...date("scanDate","Ultrasound date"),when:["method","ultrasound"]},
   {...num("scanWeeks","Gestational age on scan · completed weeks",5,40),step:"1",when:["method","ultrasound"]},
   {...num("scanDays","Additional days on scan",0,6),step:"1",when:["method","ultrasound"]}],dueSchema,p=>{
     let edd:string; const details:[string,string][]=[];
     if(p.method==="lmp")edd=days(p.lmp,280);
     else if(p.method==="conception")edd=days(p.conceptionDate,266);
     else if(p.method==="ivf")edd=days(p.transferDate,266-p.embryoAgeDays);
     else {const ga=p.scanWeeks*7+p.scanDays;edd=days(p.scanDate,280-ga);
       if(p.lmp){const lmpEdd=days(p.lmp,280),diff=Math.abs(dayDiff(edd,lmpEdd));
         const threshold=ga<63?5:ga<112?7:ga<154?10:ga<196?14:21;
         details.push(["LMP-based due date",lmpEdd],["Absolute discrepancy",`${diff} days`],["ACOG review threshold",`More than ${threshold} days at this scan gestation`],
           ["Redating comparison",diff>threshold?"Discrepancy exceeds threshold; clinician review required":"Does not exceed this threshold; clinical context still matters"]);
       }
     }
     return result("calculate_due_date","Pregnancy due date calculator",edd,"","Estimated due date",
       "Confirm the final obstetric due date with your maternity clinician. An early ultrasound and the reliability of the dates matter; keep an established due date unless a clinician documents a reason to change it.",
       [["Dating method",p.method],...details],
       ["LMP dating assumes a 28-day cycle with ovulation around day 14. Irregular cycles or an uncertain LMP reduce reliability. Intercourse date is not necessarily conception date.","IVF dating uses transfer date plus 263 days for a day-3 embryo or 261 days for a day-5 embryo. ART-derived dating should take precedence over a scan-based recalculation.","First-trimester ultrasound is most accurate. Third-trimester redating requires particular caution because a small fetus may have growth restriction. This calculator never automatically changes a clinician-established date.","The due date is an estimate, not a predicted day of birth."],[ACOG]);
   },{method:"ivf",transferDate:"2026-10-01",embryoAgeDays:5});

const fibSchema=z.object({age,astUL:z.number().positive().max(10000),altUL:z.number().positive().max(10000),platelets109L:z.number().positive().max(2000),
  acutelyIll:z.literal(false),masldContext:z.literal(true).describe("Confirm this interpretation is for suspected/known metabolic fatty liver, not generic hepatitis staging.")});
const fib=define(7,"calculate_fib4","FIB-4 liver fibrosis score","Sterling equation · AASLD age-adjusted interpretation",
  "Calculate FIB-4 from age, AST, ALT and platelets from the same assessment, with metabolic fatty liver interpretation.",
  [ageField,num("astUL","AST · U/L",0.1,10000),num("altUL","ALT · U/L",0.1,10000),num("platelets109L","Platelets · ×10⁹/L",0.1,2000,"For example, 200. Do not enter 200,000 cells/µL."),bool("acutelyIll","Currently acutely ill?"),bool("masldContext","Assessment for suspected or known metabolic fatty liver?")],fibSchema,p=>{
    const score=p.age*p.astUL/(p.platelets109L*Math.sqrt(p.altUL)),cut=p.age>65?2:1.3;
    const band=p.age<35?"Age limits interpretation":score<cut?"Lower screening risk":score>=2.67?"Higher screening risk":"Indeterminate screening result";
    return result("calculate_fib4","FIB-4 liver fibrosis score",score.toFixed(2),"",band,
      p.age<35?"FIB-4 is inaccurate below 35. Do not use a low score for reassurance; discuss an appropriate secondary assessment.":score<cut?"A lower score reduces the likelihood of advanced fibrosis in the intended setting, but does not exclude all liver disease. Follow-up depends on diabetes, metabolic risk and clinical findings.":"Discuss secondary assessment such as liver elastography or ELF with a clinician. A high score is not a fibrosis stage or a diagnosis of cirrhosis.",
      [["Equation","Age × AST / (platelets × √ALT)"],["Lower threshold for this age",String(cut)],["Higher threshold","2.67 (Table 5 high-risk band)"]],
      ["This interpretation follows the AASLD metabolic fatty liver pathway. The original Sterling study involved HIV/HCV coinfection and used different cut-offs.","Do not use FIB-4 during acute illness. Accuracy is poor under 35; the lower threshold changes above age 65. Other causes of abnormal enzymes or platelets can distort the score.","Blood results should be from the same clinical assessment. Risk bands cannot assign histological fibrosis stages."],
      [ref("Sterling et al. (2006) — original FIB-4","https://pubmed.ncbi.nlm.nih.gov/16729309/"),AASLD],p.age>=35&&score<cut?"normal":score>=2.67?"concerning":"follow_up");
  },{age:50,astUL:30,altUL:40,platelets109L:200,acutelyIll:false,masldContext:true});

const syndromeSchema=z.object({age,sex,waistCm:waist,triglyceridesMgDl:z.number().min(10).max(5000),hdlMgDl:z.number().min(5).max(200),
  systolicMmHg:z.number().min(60).max(300),diastolicMmHg:z.number().min(30).max(200),fastingGlucoseMgDl:z.number().min(20).max(1000),
  fastingSample:z.literal(true),treatedHighTriglycerides:z.boolean(),treatedLowHdl:z.boolean(),treatedHypertension:z.boolean(),treatedHighGlucose:z.boolean(),isPregnant:noPregnancy})
  .refine(p=>p.systolicMmHg>p.diastolicMmHg,{message:"Systolic blood pressure must exceed diastolic blood pressure.",path:["systolicMmHg"]});
const syndrome=define(8,"check_metabolic_syndrome","Metabolic syndrome check","Harmonised 2009 criteria · South Asian waist limits",
  "Check the five harmonised metabolic syndrome components using measured blood pressure and fasting laboratory results.",
  [ageField,sexField,num("waistCm","Waist · cm",30,250,"Midway between the lowest rib and hip bone, after a normal breath out."),num("triglyceridesMgDl","Fasting triglycerides · mg/dL",10,5000),num("hdlMgDl","HDL cholesterol · mg/dL",5,200),
   num("systolicMmHg","Systolic BP · mmHg",60,300),num("diastolicMmHg","Diastolic BP · mmHg",30,200),num("fastingGlucoseMgDl","Fasting plasma glucose · mg/dL",20,1000),bool("fastingSample","Were the laboratory values fasting?"),
   bool("treatedHighTriglycerides","Treatment specifically for high triglycerides?"),bool("treatedLowHdl","Treatment specifically for low HDL?","A statin for raised LDL alone does not establish this component."),bool("treatedHypertension","Treatment for hypertension?"),bool("treatedHighGlucose","Treatment for elevated glucose?"),pregnancyField],syndromeSchema,p=>{
     const parts:[string,boolean][]=[["South Asian waist",p.waistCm>=(p.sex==="male"?90:80)],["Triglycerides ≥150 mg/dL or treatment",p.triglyceridesMgDl>=150||p.treatedHighTriglycerides],
       ["HDL <40 (men) / <50 (women) or treatment",p.hdlMgDl<(p.sex==="male"?40:50)||p.treatedLowHdl],["BP ≥130 systolic or ≥85 diastolic or treatment",p.systolicMmHg>=130||p.diastolicMmHg>=85||p.treatedHypertension],
       ["Fasting glucose ≥100 mg/dL or treatment",p.fastingGlucoseMgDl>=100||p.treatedHighGlucose]];
     const count=parts.filter(x=>x[1]).length,urgent=p.systolicMmHg>=180||p.diastolicMmHg>=120||p.fastingGlucoseMgDl<54;
     return result("check_metabolic_syndrome","Metabolic syndrome check",String(count),"/ 5 components",urgent?"A measurement needs prompt clinical attention":count>=3?"Meets the component-count criterion":"Below the three-component criterion",
       urgent?"Seek prompt medical assessment for the markedly abnormal reading. Chest pain, breathlessness, confusion or neurological symptoms require emergency care; this checklist must not delay care.":count>=3?"At least three components are present. Arrange a clinical review to confirm measurements and assess cardiovascular and diabetes risk.":"Fewer than three components are present. Individual abnormal measurements still need attention; this is not a cardiovascular risk percentage.",
       parts.map(([k,v])=>[k,v?"Present":"Not present"]),["Harmonised criteria require any three of five components; abdominal obesity is not mandatory. South Asian waist limits are 90 cm for men and 80 cm for women.","Medication counts only when prescribed for the specified abnormality. Confirm fasting values, reliable BP measurements and units; this is an adult non-pregnant assessment."],
       [ref("Alberti et al. (2009) — harmonised metabolic syndrome","https://doi.org/10.1161/CIRCULATIONAHA.109.192644")],urgent?"concerning":count>=3?"follow_up":"informational");
   },{age:40,sex:"male",waistCm:90,triglyceridesMgDl:150,hdlMgDl:40,systolicMmHg:130,diastolicMmHg:80,fastingGlucoseMgDl:99,fastingSample:true,treatedHighTriglycerides:false,treatedLowHdl:false,treatedHypertension:false,treatedHighGlucose:false,isPregnant:false});

const bodySchema=z.object({age,sex,heightCm:height,neckCm:z.number().min(20).max(70),circumferenceCm:waist,hipCm:z.number().min(40).max(250).optional(),isPregnant:noPregnancy})
  .superRefine((p,ctx)=>{if(p.sex==="female"&&p.hipCm===undefined)ctx.addIssue({code:"custom",path:["hipCm"],message:"Hip measurement is required for the female equation."});
    if(p.circumferenceCm+(p.sex==="female"?(p.hipCm??0):0)<=p.neckCm)ctx.addIssue({code:"custom",path:["circumferenceCm"],message:"Circumferences must produce a positive log argument; recheck the measurements."});});
const body=define(9,"calculate_body_fat","Body fat calculator","Historical US Navy tape equation · Indian 2025 comparison",
  "Estimate body fat from tape measurements using the historical Navy equation. It has not been established as a diagnostic substitute for body-composition measurement in Indians.",
  [ageField,sexField,num("heightCm","Height · cm",100,250),num("neckCm","Neck · cm",20,70,"Measure just below the larynx with the tape slightly sloping down at the front."),
   num("circumferenceCm","Abdomen (men) or natural waist (women) · cm",30,250,"Men: at the navel. Women: narrowest natural waist. Tape level; measure after a normal breath out."),
   {...num("hipCm","Hip circumference · cm",40,250,"Women: widest buttock circumference with tape level."),when:["sex","female"]},pregnancyField],bodySchema,p=>{
    const h=p.heightCm/2.54,d=(p.circumferenceCm+(p.sex==="female"?p.hipCm!:0)-p.neckCm)/2.54;
    const fat=p.sex==="male"?86.010*Math.log10(d)-70.041*Math.log10(h)+36.76:163.205*Math.log10(d)-97.684*Math.log10(h)-78.387;
    if(fat<=0||fat>=75)throw new Error("The equation produced an implausible body-fat estimate. Recheck measurement sites and units; a direct assessment may be more suitable.");
    const cutoff=p.sex==="male"?25.5:38,above=fat>cutoff;
    return result("calculate_body_fat","Body fat calculator",fat.toFixed(1),"%","Tape-based body-fat estimate",
      "Treat this as a rough estimate. Compare repeat measurements using the same technique; confirm any clinically important result with an appropriate body-composition assessment.",
      [["Indian 2025 body-fat comparison",above?`Estimate is above ${cutoff}%`:`Estimate is not above ${cutoff}%`],["Equation units","Centimetres converted to inches before applying log₁₀"]],
      ["The 2025 Indian body-fat thresholds are >25.5% for men and >38% for women. Applying those thresholds to a Navy estimate is an approximate comparison, not validated Indian diagnostic staging.","Tape technique, body shape, muscularity and the population used to develop the equation affect accuracy. No result is silently clamped into a plausible range.","Adult, non-pregnant use only; this is the historical regression method, not a claim of current military fitness eligibility."],
      [ref("Naval Health Research Center — development of DoD body-composition equations (1999)","https://ntrl.ntis.gov/NTRL/dashboard/searchResults/titleDetail/ADA370158.xhtml"),INDIA],above?"follow_up":"informational");
  },{age:35,sex:"male",heightCm:175,neckCm:38,circumferenceCm:90,isPregnant:false});

const whSchema=z.object({age,waistCm:waist,heightCm:height,weightKg:weight,isPregnant:noPregnancy});
const wh=define(10,"calculate_waist_height","Waist-to-height ratio","NICE 2022 waist-to-height bands",
  "Calculate waist-to-height ratio and apply NICE adult central-adiposity bands when BMI is below 35.",
  [ageField,num("waistCm","Waist · cm",30,250,"Midway between lowest ribs and hips, after breathing out naturally."),num("heightCm","Height · cm",100,250),num("weightKg","Weight · kg",20,500,"Used to check whether the NICE bands apply."),pregnancyField],whSchema,p=>{
    const r=p.waistCm/p.heightCm,bmi=p.weightKg/(p.heightCm/100)**2;
    const category=bmi>=35?"NICE band interpretation withheld at BMI ≥35":r<0.4?"Below the published healthy central-adiposity band":r<0.5?"Healthy central-adiposity band":r<0.6?"Increased central adiposity":"High central adiposity";
    return result("calculate_waist_height","Waist-to-height ratio",r.toFixed(3),"",category,"NICE advises keeping waist circumference below half of height. Interpret the ratio alongside BMI, clinical history and metabolic measurements.",
      [["BMI",bmi.toFixed(2)+" kg/m²"],["Waist equal to half your height",`${round(p.heightCm/2)} cm`]],
      ["NICE bands: 0.4–<0.5 healthy central adiposity, 0.5–<0.6 increased, ≥0.6 high. These bands apply at BMI <35 in adults of all sexes and ethnicities.","A ratio below 0.4 is outside the listed healthy band; it is not automatically diagnosed as underweight. A favourable ratio does not exclude other health risks.","The ratio is calculated from matching units and classified before rounding; pregnancy changes its interpretation."],[NICE],bmi>=35||r>=0.5?"follow_up":"informational");
  },{age:35,waistCm:85,heightCm:170,weightKg:70,isPregnant:false});

const hrSchema=z.object({age:age.max(81),heartRateAffectingMedication:z.boolean(),heartCondition:z.boolean(),exerciseSymptoms:z.boolean(),isPregnant:z.boolean(),restingBpm:z.number().min(30).max(120).optional()})
  .refine(p=>p.restingBpm===undefined||p.restingBpm<208-0.7*p.age,{path:["restingBpm"],message:"Resting pulse must be below predicted maximum for a reserve calculation."});
const hr=define(11,"calculate_heart_rate_zones","Heart rate zones","Tanaka maximum · ACSM intensity categories",
  "Estimate maximum heart rate and ACSM moderate/vigorous ranges for generally healthy adults aged 18–81.",
  [{...ageField,max:81},num("restingBpm","Resting pulse · beats/min",30,120,"Optional: measured at rest for heart-rate-reserve ranges.",true),
   bool("heartRateAffectingMedication","Medicines affecting heart rate, such as beta blockers?"),bool("heartCondition","Known heart condition?"),bool("exerciseSymptoms","Chest pain, fainting or unusual breathlessness during exercise?"),pregnancyField],hrSchema,p=>{
    const max=208-0.7*p.age,withhold=p.heartRateAffectingMedication||p.heartCondition||p.exerciseSymptoms||p.isPregnant;
    const range=(a:number,b:number)=>`${Math.round(a)}–${Math.round(b)} beats/min`;
    const details:[string,string][]=[["Predicted maximum",`${round(max)} beats/min`]];
    if(!withhold){details.push(["Moderate · 64–76% HRmax",range(max*.64,max*.76)],["Vigorous · 77–95% HRmax",range(max*.77,max*.95)]);
      if(p.restingBpm!==undefined){const reserve=max-p.restingBpm;details.push(["Moderate · 40–59% HR reserve",range(p.restingBpm+.4*reserve,p.restingBpm+.59*reserve)],["Vigorous · 60–89% HR reserve",range(p.restingBpm+.6*reserve,p.restingBpm+.89*reserve)]);}}
    return result("calculate_heart_rate_zones","Heart rate zones",withhold?"Clinical review":String(round(max)),withhold?"":"beats/min",withhold?"Training ranges withheld":"Predicted maximum heart rate",
      p.exerciseSymptoms?"Stop exercising and seek medical assessment. Ongoing chest pain, fainting or severe breathlessness requires urgent care.":withhold?"Ask your clinician for an individual exercise plan; age-predicted targets can be inappropriate with these conditions.":"Use these as approximate intensity categories, with how you feel and the talk test. A measured exercise assessment can give more appropriate individual targets.",details,
      ["Tanaka's equation is 208 − 0.7 × age. It predicts a population average, with substantial individual error; it is not a measured maximum or a safe upper limit.","ACSM moderate/vigorous percentage categories are not interchangeable between HRmax and HR reserve. They are not five validated metabolic training zones.","Rounded displayed endpoints do not cover every intensity. This tool does not assess cardiac fitness or provide exercise clearance."],
      [ref("Tanaka et al. (2001)","https://pubmed.ncbi.nlm.nih.gov/11153730/"),ref("ACSM position stand — exercise prescription (2011)","https://doi.org/10.1249/MSS.0b013e318213fefb")],p.exerciseSymptoms?"concerning":withhold?"follow_up":"informational");
  },{age:40,heartRateAffectingMedication:false,heartCondition:false,exerciseSymptoms:false,isPregnant:false,restingBpm:60});

const packSchema=z.object({age,cigarettesPerDay:z.number().min(0).max(200),yearsSmoked:z.number().min(0).max(100),currentlySmoking:z.boolean(),yearsSinceQuit:z.number().min(0).max(100).optional()})
  .superRefine((p,ctx)=>{if(!p.currentlySmoking&&p.yearsSinceQuit===undefined)ctx.addIssue({code:"custom",path:["yearsSinceQuit"],message:"Years since quitting is required for former smokers (0 for less than a year)."});
    if(p.currentlySmoking&&p.yearsSinceQuit!==undefined&&p.yearsSinceQuit!==0)ctx.addIssue({code:"custom",path:["yearsSinceQuit"],message:"Current smoking is inconsistent with a past quit interval."});
    if(p.yearsSmoked+(p.currentlySmoking?0:p.yearsSinceQuit??0)>p.age)ctx.addIssue({code:"custom",path:["yearsSmoked"],message:"Smoking duration and time since quitting cannot exceed age."});});
const pack=define(12,"calculate_pack_years","Pack-year smoking calculator","Pack-years · USPSTF 2021 · WHO cessation benefits",
  "Calculate cigarette exposure using 20 cigarettes per pack, and compare age/exposure with the US screening recommendation.",
  [ageField,num("cigarettesPerDay","Average cigarettes/day during smoking years",0,200,"Use a time-weighted average if smoking intensity changed. Do not convert bidis or vaping to cigarettes."),num("yearsSmoked","Total years smoking",0,100,"Exclude periods when you did not smoke."),bool("currentlySmoking","Currently smoking?"),num("yearsSinceQuit","Years since quitting",0,100,"Required for former smokers; fractions are accepted. Leave blank for current smoking.",true)],packSchema,p=>{
    const py=p.cigarettesPerDay/20*p.yearsSmoked,meets=p.age>=50&&p.age<=80&&py>=20&&(p.currentlySmoking||p.yearsSinceQuit!<15);
    return result("calculate_pack_years","Pack-year smoking calculator",py.toFixed(2),"pack-years",meets?"Meets US age/exposure screening criteria":"Does not meet this US age/exposure screen",
      meets?"Discuss low-dose CT screening with a clinician. USPSTF criteria also depend on fitness and willingness for curative treatment. These are US recommendations; suitability and availability in India need local clinical review.":"This does not exclude lung disease or cancer. Persistent cough, coughing blood or unexplained weight loss needs medical assessment regardless of pack-years. Quitting tobacco offers benefits at any exposure level.",
      [["Equation","Average cigarettes/day ÷ 20 × total smoking years"],["WHO cessation milestones (population-level)","20 minutes: pulse/BP drop; 12 hours: carbon monoxide falls; 2–12 weeks: circulation/lung function improve; longer-term disease risks fall"]],
      ["USPSTF 2021: ages 50–80, ≥20 pack-years and current smoking or quit <15 years; discontinue at 15 years since quitting or when health prevents curative treatment.","Pack-years are cumulative cigarette exposure, not an individual cancer probability. Other tobacco products and passive exposure cannot be reliably converted by this equation.","WHO milestones describe typical benefits, not guaranteed changes for an individual."],
      [ref("USPSTF — Lung cancer screening (2021)","https://www.uspreventiveservicestaskforce.org/uspstf/document/RecommendationStatementFinal/lung-cancer-screening"),ref("WHO — health benefits of cessation","https://www.who.int/news-room/questions-and-answers/item/tobacco-health-benefits-of-smoking-cessation")],meets?"follow_up":"informational");
  },{age:55,cigarettesPerDay:20,yearsSmoked:25,currentlySmoking:false,yearsSinceQuit:10});

// NFA permits commercial and non-commercial use with attribution. Preserve original items and domains.
export const cbiQuestions={personal:["How often do you feel tired?","How often are you physically exhausted?","How often are you emotionally exhausted?","How often do you think: ‘I can’t take it anymore’?","How often do you feel worn out?","How often do you feel weak and susceptible to illness?"],
  work:["Is your work emotionally exhausting?","Do you feel burnt out because of your work?","Does your work frustrate you?","Do you feel worn out at the end of the working day?","Are you exhausted in the morning at the thought of another day at work?","Do you feel that every working hour is tiring for you?","Do you have enough energy for family and friends during leisure time?"],
  client:["Do you find it hard to work with clients?","Do you find it frustrating to work with clients?","Does it drain your energy to work with clients?","Do you feel that you give more than you get back when you work with clients?","Are you tired of working with clients?","Do you sometimes wonder how long you will be able to continue working with clients?"]};
const cbiItem=z.union([z.literal(0),z.literal(25),z.literal(50),z.literal(75),z.literal(100)]);
const burnoutSchema=z.object({personal:z.array(cbiItem).length(6),work:z.array(cbiItem).length(7).optional(),client:z.array(cbiItem).length(6).optional()});
const frequency:[string,string][]=[["100","Always"],["75","Often"],["50","Sometimes"],["25","Seldom"],["0","Never / almost never"]];
const degree:[string,string][]=[["100","To a very high degree"],["75","To a high degree"],["50","Somewhat"],["25","To a low degree"],["0","To a very low degree"]];
const burnoutFields=Object.entries(cbiQuestions).flatMap(([domain,questions])=>questions.map((q,i)=>({...sel(`${domain}.${i}`,q,domain==="work"&&i<3||domain==="client"&&i<4?degree:frequency,
  domain==="personal"?"Personal exhaustion":domain==="work"?"Optional work domain: complete all 7, or leave all blank.":"Optional client/patient domain: complete all 6, or leave all blank.",domain!=="personal"),valueType:"number" as const})));
const burnout=define(13,"assess_burnout","Burnout test","Copenhagen Burnout Inventory · separate domain means",
  "Complete the original CBI personal exhaustion domain and optional work/client domains. Scores measure reported exhaustion; they do not diagnose a psychiatric condition.",burnoutFields,burnoutSchema,p=>{
    const mean=(a:number[])=>a.reduce((s,v)=>s+v,0)/a.length,personal=mean(p.personal),details:[string,string][]=[["Personal exhaustion",`${round(personal)} / 100`]];
    if(p.work)details.push(["Work-related exhaustion",`${round(mean(p.work.map((v,i)=>i===6?100-v:v)))} / 100`]);
    if(p.client)details.push(["Client-related exhaustion",`${round(mean(p.client))} / 100`]);
    return result("assess_burnout","Burnout test",String(round(personal)),"/ 100","Personal exhaustion domain",
      "Higher domain scores reflect more reported exhaustion. If exhaustion persists, affects daily life or work, or occurs with low mood or anxiety, discuss it with a healthcare professional and consider workplace support.",details,
      ["There is no universal diagnostic cut-off in the original CBI. No low/moderate/high diagnosis or overall combined score is generated.","Each domain is averaged separately. The last work item about energy for family/friends is reverse-scored. Work and client domains should only be completed when applicable.","All items in a selected domain are required here to avoid silently imputing missing responses. The original research allows specified partial completion, which this implementation does not use.","Fatigue can have medical as well as occupational causes. This questionnaire cannot distinguish them."],[CBI,ref("Borritz et al. (2006) — PUMA study, CBI attribution","https://doi.org/10.1080/14034940510032275")]);
  },{personal:[50,50,50,50,50,50],work:[50,50,50,50,50,50,100]});

const phenoSchema=z.object({age:age.min(20),albuminGL:z.number().min(10).max(65),creatinineUmolL:z.number().min(10).max(2000),glucoseMmolL:z.number().min(1).max(50),
  crpMgL:z.number().positive().max(500),lymphocytePercent:z.number().min(0).max(100),mcvFL:z.number().min(40).max(150),rdwPercent:z.number().min(5).max(40),alkalinePhosphataseUL:z.number().min(1).max(2000),wbc109L:z.number().min(.1).max(100)});
const pheno=define(14,"calculate_phenoage","Biological age calculator","Clinical PhenoAge · Levine 2018 published Table S1",
  "Calculate clinical phenotypic age from chronological age and all nine blood markers. This is a research-model estimate, not a literal biological age or lifespan prediction.",
  [{...ageField,min:20},num("albuminGL","Albumin · g/L",10,65,"Convert g/dL ×10; for example 4.2 g/dL = 42 g/L."),num("creatinineUmolL","Creatinine · µmol/L",10,2000,"Convert mg/dL ×88.4."),
   num("glucoseMmolL","Glucose · mmol/L",1,50,"Convert mg/dL ÷18.0182."),num("crpMgL","CRP · mg/L (strictly greater than zero)",.001,500,"Enter a measured numeric result; do not substitute 0 for ‘below detection’. The engine converts to mg/dL before ln."),
   num("lymphocytePercent","Lymphocytes · %",0,100,"Use percentage, not absolute lymphocyte count."),num("mcvFL","Mean cell volume · fL",40,150),num("rdwPercent","RDW-CV · %",5,40,"Use RDW-CV percentage, not RDW-SD in fL."),
   num("alkalinePhosphataseUL","Alkaline phosphatase · U/L",1,2000),num("wbc109L","White blood cells · ×10⁹/L",.1,100,"Numerically identical to 1,000 cells/µL.")],phenoSchema,p=>{
    // Use coefficients printed in the primary Table S1, not unexplained extra precision from third-party calculators.
    const xb=-19.9067-.0336*p.albuminGL+.0095*p.creatinineUmolL+.1953*p.glucoseMmolL+.0954*Math.log(p.crpMgL/10)-.012*p.lymphocytePercent+.0268*p.mcvFL+.3306*p.rdwPercent+.0019*p.alkalinePhosphataseUL+.0554*p.wbc109L+.0804*p.age;
    // Algebraically equivalent to ln(-.00553*ln(1-CDF)); prevents CDF rounding to 1 at extreme inputs.
    const gamma=.0076927,logHazard=xb+Math.log(Math.expm1(120*gamma)/gamma);
    const pa=141.50225+(Math.log(.00553)+logHazard)/.090165;
    return result("calculate_phenoage","Biological age calculator",pa.toFixed(1),"years","Clinical phenotypic age estimate",
      "This maps a blood-marker profile to an age-equivalent research-model estimate. Review abnormal laboratory findings on their own clinical merits; this result is not a diagnosis of accelerated ageing.",
      [["Chronological age",`${p.age} years`],["Phenotypic minus chronological age",`${round(pa-p.age)} years`],["Model version","Published Table S1 coefficients; constant −19.9067, ALP 0.0019; γ 0.0076927"]],
      ["The US NHANES model was developed in adults aged 20+. It is not a validated India-specific individual age or mortality calculator; ethnic/population calibration may differ.","This is clinical blood-marker PhenoAge, distinct from DNAm PhenoAge, which requires methylation data. The raw age difference is not the regression-residual PhenoAge acceleration measure.","Use all nine laboratory markers with exactly the stated units, preferably from the same assessment. Infection, inflammation and laboratory variation can change the result; censored CRP cannot be represented by zero.","Printed coefficient precision is explicitly used, so small differences from implementations using rounded −19.907 or extra-precision ALP are expected. Extreme outputs are not clamped or interpreted as lifespan."],[PHENO]);
  },{age:50,albuminGL:43,creatinineUmolL:80,glucoseMmolL:5,crpMgL:1,lymphocytePercent:30,mcvFL:90,rdwPercent:13,alkalinePhosphataseUL:70,wbc109L:6});

const pcosSchema=z.object({age:age.max(55),yearsSinceMenarche:z.number().min(0).max(45),shortestCycleDays:z.number().int().min(10).max(365),longestCycleDays:z.number().int().min(10).max(365),cyclesPerYear:z.number().int().min(0).max(40),
  excessCoarseHair:z.boolean(),clinicianConfirmedHighAndrogens:z.boolean(),acneOrHairThinning:z.boolean(),rapidVirilisation:z.boolean(),usesHormonalContraception:z.boolean(),isPregnant:z.boolean()})
  .refine(p=>p.longestCycleDays>=p.shortestCycleDays,{path:["longestCycleDays"],message:"Longest cycle cannot be shorter than shortest cycle."})
  .refine(p=>p.yearsSinceMenarche<=p.age-8,{path:["yearsSinceMenarche"],message:"Check years since menarche against your age."});
const pcos=define(15,"check_pcos_symptoms","PCOS symptom checker","International PCOS guideline 2023 · assessment prompts",
  "Check whether reported cycle or androgen-related features warrant a PCOS assessment. No symptom score can establish PCOS.",
  [{...ageField,max:55},num("yearsSinceMenarche","Years since your first period",0,45),num("shortestCycleDays","Shortest cycle in the past year · days",10,365),num("longestCycleDays","Longest cycle in the past year · days",10,365),num("cyclesPerYear","Number of periods in the past year",0,40),
   bool("excessCoarseHair","New or excess coarse facial/body hair?"),bool("clinicianConfirmedHighAndrogens","High androgen blood levels confirmed by a clinician?"),bool("acneOrHairThinning","Acne or scalp hair thinning?"),bool("rapidVirilisation","Rapid hair growth, deepening voice or other rapid masculinising changes?"),bool("usesHormonalContraception","Using hormonal contraception?"),pregnancyField],pcosSchema,p=>{
    const irregular=p.yearsSinceMenarche<1?false:p.shortestCycleDays<21||p.longestCycleDays>(p.yearsSinceMenarche<3?45:35)||(p.yearsSinceMenarche>=3&&p.cyclesPerYear<8)||p.longestCycleDays>90;
    const androgen=p.excessCoarseHair||p.clinicianConfirmedHighAndrogens,limited=p.isPregnant||p.usesHormonalContraception||p.yearsSinceMenarche<1;
    return result("check_pcos_symptoms","PCOS symptom checker",p.rapidVirilisation?"Prompt review":limited?"Limited interpretation":irregular||androgen||p.acneOrHairThinning?"Assessment advised":"No listed features reported","","Guideline-based assessment prompts",
      p.rapidVirilisation?"Arrange prompt medical assessment for rapid androgen-related changes; causes other than PCOS need evaluation.":limited?"Pregnancy, early post-menarche development or hormonal contraception limits interpretation. Discuss cycle changes with a clinician.":irregular||androgen?"A clinician should assess these features and exclude other causes, including thyroid disease, raised prolactin and non-classic congenital adrenal hyperplasia. Reported symptoms do not establish the diagnosis.":"Absence of these features cannot rule out PCOS. Acne or scalp thinning alone is a weaker marker of androgen excess; persistent concerns warrant review.",
      [["Cycle pattern",irregular?"Meets a guideline irregular-cycle definition":"Does not meet the entered-cycle definition"],["Reported androgen-related feature",androgen?"Present; requires clinical confirmation":"Not reported"],["Life-stage interpretation",p.yearsSinceMenarche<8?"Within 8 years of menarche: special diagnostic caution":"Adult assessment context"]],
      ["At 1–<3 years post-menarche, cycles <21 or >45 days are irregular; after 3 years, <21 or >35 days or <8 cycles/year. After the first year, any >90-day cycle also warrants assessment.","Adults require two of ovulatory dysfunction, clinical/biochemical androgen excess and polycystic ovarian morphology (or appropriately used AMH), after excluding alternatives. A symptom checklist does not confirm these criteria.","Adolescents require both ovulatory dysfunction and hyperandrogenism; ultrasound and AMH are not recommended for diagnosis. Within 8 years of menarche, reassessment may be needed.","Regular cycles can still be anovulatory. This tool provides no PCOS probability and does not interpret ultrasound or AMH reports."],[PCOS],p.rapidVirilisation?"concerning":limited||irregular||androgen||p.acneOrHairThinning?"follow_up":"informational");
  },{age:25,yearsSinceMenarche:12,shortestCycleDays:40,longestCycleDays:60,cyclesPerYear:6,excessCoarseHair:true,clinicianConfirmedHighAndrogens:false,acneOrHairThinning:false,rapidVirilisation:false,usesHormonalContraception:false,isPregnant:false});

const thyroidSchema=z.object({age,fatigue:z.boolean(),coldIntolerance:z.boolean(),constipation:z.boolean(),drySkin:z.boolean(),unexplainedWeightChange:z.boolean(),heatIntolerance:z.boolean(),palpitations:z.boolean(),neckSwelling:z.boolean(),
  severeCurrentSymptoms:z.boolean().describe("Current chest pain, fainting, severe breathlessness, confusion, or difficulty breathing due to neck swelling."),isPregnant:z.boolean(),knownThyroidDisease:z.boolean()});
const thyroid=define(16,"check_thyroid_symptoms","Thyroid symptom checker","ATA guidance · symptom and test assessment",
  "Identify thyroid-related symptom patterns and appropriate testing discussions. Symptoms alone cannot diagnose an underactive or overactive thyroid.",
  [ageField,...[["fatigue","Persistent fatigue?"],["coldIntolerance","Unusual cold intolerance?"],["constipation","Persistent constipation?"],["drySkin","Dry skin?"],["unexplainedWeightChange","Unexplained weight change?"],["heatIntolerance","Unusual heat intolerance?"],["palpitations","Palpitations or a racing pulse?"],["neckSwelling","Neck swelling or a thyroid-area lump?"],["severeCurrentSymptoms","Current chest pain, fainting, severe breathlessness, confusion or difficulty breathing?"]].map(([n,l])=>bool(n,l)),pregnancyField,bool("knownThyroidDisease","Previously diagnosed thyroid disease?")],thyroidSchema,p=>{
    const symptoms=p.fatigue||p.coldIntolerance||p.constipation||p.drySkin||p.unexplainedWeightChange||p.heatIntolerance||p.palpitations||p.neckSwelling;
    return result("check_thyroid_symptoms","Thyroid symptom checker",p.severeCurrentSymptoms?"Urgent care":symptoms||p.knownThyroidDisease?"Clinical review":"No listed symptoms","","Symptoms do not establish thyroid status",
      p.severeCurrentSymptoms?"Seek urgent medical care for these current symptoms. Do not wait for a thyroid test or use this checker to determine their cause.":symptoms||p.knownThyroidDisease?"Discuss examination and thyroid function testing (usually TSH and, when indicated, free T4) with a clinician. A neck lump needs examination; do not change thyroid medicines from symptoms alone.":"Thyroid disease can occur without obvious symptoms. Testing decisions depend on clinical history and relevant risk factors.",
      [["Blood tests","TSH and free T4 interpreted with the laboratory reference intervals"],["Pregnancy",p.isPregnant?"Pregnancy-specific interpretation and clinical review needed":"Not reported"]],
      ["Symptoms are non-specific and overlap with anaemia, sleep problems, medication effects and other conditions. No validated diagnostic symptom score or individual disease probability is produced.","Pituitary disease can make TSH misleading. Pregnancy and some medicines or supplements (including biotin) alter interpretation; tell the clinician about them.","Population prevalence from Indian studies cannot be converted to your individual chance of thyroid disease."],
      [THYROID,ref("ATA/AACE clinical practice guideline (2012)","https://doi.org/10.1089/thy.2012.0205"),ref("Unnikrishnan et al. — eight-city Indian study (2013)","https://pmc.ncbi.nlm.nih.gov/articles/PMC3743364/")],p.severeCurrentSymptoms?"concerning":symptoms||p.knownThyroidDisease||p.isPregnant?"follow_up":"informational");
  },{age:35,fatigue:true,coldIntolerance:true,constipation:false,drySkin:false,unexplainedWeightChange:false,heatIntolerance:false,palpitations:false,neckSwelling:false,severeCurrentSymptoms:false,isPregnant:false,knownThyroidDisease:false});

const gutSchema=z.object({age,symptomMonths:z.number().min(0).max(600),abdominalPain:z.boolean(),painRelatedToDefecation:z.boolean(),changedStoolFrequency:z.boolean(),changedStoolForm:z.boolean(),bloating:z.boolean(),heartburn:z.boolean(),
  bloodInStool:z.boolean(),unintentionalWeightLoss:z.boolean(),knownAnaemia:z.boolean(),difficultySwallowing:z.boolean(),persistentVomiting:z.boolean(),familyHistoryBowelCancerOrIbd:z.boolean(),severeCurrentSymptoms:z.boolean().describe("Severe abdominal pain, heavy bleeding, black tarry stool, vomiting blood, fainting or inability to keep fluids down.")});
const gut=define(17,"assess_gut_symptoms","Gut health quiz","BSG IBS · NICE CG61, CG184 and NG20",
  "Review persistent bowel or reflux symptoms and warning signs. This is an assessment guide, not a microbiome health score or an IBS diagnosis.",
  [ageField,num("symptomMonths","How long have symptoms been present? · months",0,600),...[["abdominalPain","Abdominal pain or discomfort?"],["painRelatedToDefecation","Pain/discomfort related to bowel movements?"],["changedStoolFrequency","Change in bowel movement frequency?"],["changedStoolForm","Change in stool form/consistency?"],["bloating","Bloating?"],["heartburn","Heartburn or acid reflux?"],["bloodInStool","Blood in stool?"],["unintentionalWeightLoss","Unintentional weight loss?"],["knownAnaemia","Anaemia confirmed by a clinician?"],["difficultySwallowing","Difficulty swallowing?"],["persistentVomiting","Persistent vomiting?"],["familyHistoryBowelCancerOrIbd","Family history of bowel cancer or inflammatory bowel disease?"],["severeCurrentSymptoms","Severe current pain, heavy bleeding, black tarry stool, vomiting blood, fainting or inability to keep fluids down?"]].map(([n,l])=>bool(n,l))],gutSchema,p=>{
    const alarm=p.bloodInStool||p.unintentionalWeightLoss||p.knownAnaemia||p.difficultySwallowing||p.persistentVomiting||p.familyHistoryBowelCancerOrIbd;
    const bowel=p.symptomMonths>=6&&p.abdominalPain&&(p.painRelatedToDefecation||p.changedStoolFrequency||p.changedStoolForm),any=p.abdominalPain||p.changedStoolFrequency||p.changedStoolForm||p.bloating||p.heartburn;
    return result("assess_gut_symptoms","Gut health quiz",p.severeCurrentSymptoms?"Urgent care":alarm?"Medical assessment":bowel?"Bowel assessment":any?"Symptom review":"No listed symptoms","","Guideline-based next steps",
      p.severeCurrentSymptoms?"Seek urgent medical care for the current warning symptoms; do not wait for a quiz result.":alarm?"Arrange medical assessment of the warning features. Do not assume IBS or treat symptoms with restrictive diets before assessment.":bowel?"Your reported pattern is a reason to assess for IBS and alternative causes. A clinician may check blood count, inflammatory markers and coeliac antibodies; additional tests depend on findings.":any?"Persistent, worsening or troublesome symptoms deserve clinical review. Reflux and bowel symptoms require different assessments; symptom duration alone does not identify the cause.":"No listed symptoms were reported. This cannot assess your microbiome or exclude gastrointestinal disease.",
      [["Persistent bowel pattern",bowel?"Present as an assessment prompt, not a diagnosis":"Not identified from these answers"],["Coeliac testing","Continue a gluten-containing diet until testing is discussed; removing gluten can make tests less reliable"]],
      ["This checklist follows assessment prompts, not a complete NICE or Rome IV diagnostic algorithm. It does not calculate an IBS probability, gut-health percentage or microbiome score.","Alarm symptoms and family history take precedence over an IBS-like pattern. New or persistent symptoms, especially at older ages, need an individual clinical assessment.","NICE recommends coeliac serology in suspected IBS. Low-FODMAP diets should be supervised by a trained practitioner; do not infer food intolerances from this quiz."],
      [GUT,CG61,ref("NICE CG184 — reflux and dyspepsia","https://www.nice.org.uk/guidance/cg184/chapter/Recommendations"),NG20],p.severeCurrentSymptoms?"concerning":alarm||any?"follow_up":"informational");
  },{age:30,symptomMonths:8,abdominalPain:true,painRelatedToDefecation:true,changedStoolFrequency:true,changedStoolForm:true,bloating:true,heartburn:false,bloodInStool:false,unintentionalWeightLoss:false,knownAnaemia:false,difficultySwallowing:false,persistentVomiting:false,familyHistoryBowelCancerOrIbd:false,severeCurrentSymptoms:false});

const weightSchema=z.object({age,weightKg:weight,heightCm:height,weightRelatedCondition:z.enum(["yes","no","unknown"]).describe("Clinician-confirmed weight-related condition e.g. hypertension, type 2 diabetes or dyslipidaemia."),
  isPregnant:z.boolean(),isBreastfeeding:z.boolean(),planningPregnancy:z.boolean(),personalOrFamilyMtcOrMen2:z.boolean(),historyPancreatitis:z.boolean(),gallbladderDisease:z.boolean(),eatingDisorder:z.boolean()});
const weightLoss=define(18,"assess_weight_loss_medication","Medical weight loss suitability","Indian regulatory indication comparison · WHO 2025",
  "Compare adult BMI and clinician-confirmed comorbidity with a published weight-management indication, and identify reasons for prescriber review. This cannot confirm medicine suitability.",
  [ageField,num("weightKg","Measured weight · kg",20,500),num("heightCm","Height · cm",100,250),sel("weightRelatedCondition","Clinician-confirmed weight-related condition?",[["yes","Yes"],["no","No"],["unknown","Unknown / not assessed"]],"For example, hypertension, type 2 diabetes or dyslipidaemia."),pregnancyField,
   bool("isBreastfeeding","Currently breastfeeding?"),bool("planningPregnancy","Planning pregnancy?"),bool("personalOrFamilyMtcOrMen2","Personal/family medullary thyroid cancer or MEN2?"),bool("historyPancreatitis","History of pancreatitis?"),bool("gallbladderDisease","Gallbladder disease?"),bool("eatingDisorder","Current or past eating disorder?")],weightSchema,p=>{
    const bmi=p.weightKg/(p.heightCm/100)**2,threshold=bmi>=30||bmi>=27&&p.weightRelatedCondition==="yes",unknown=bmi>=27&&bmi<30&&p.weightRelatedCondition==="unknown";
    const pregnancy=p.isPregnant||p.isBreastfeeding||p.planningPregnancy,review=p.personalOrFamilyMtcOrMen2||p.historyPancreatitis||p.gallbladderDisease||p.eatingDisorder;
    return result("assess_weight_loss_medication","Medical weight loss suitability",bmi.toFixed(2),"kg/m²",pregnancy?"Pregnancy/lactation planning needs clinical review":unknown?"Comorbidity information needed":threshold?"Meets this BMI/comorbidity threshold":"Below this BMI/comorbidity threshold",
      pregnancy?"Weight-loss medicines should not be initiated from this screen. Discuss pregnancy, breastfeeding or pregnancy plans with your clinician; product-specific precautions and preconception stopping intervals matter.":threshold?"A clinical consultation may be appropriate. Meeting a BMI/comorbidity threshold does not establish suitability: the prescriber must verify the exact Indian product label, contraindications, interactions and a comprehensive care plan.":unknown?"Clarify whether a weight-related condition has been diagnosed before interpreting this threshold.":"This screening comparison does not establish an indication for medication. A clinician can assess nutrition, activity, underlying causes and appropriate care independently of this threshold.",
      [["Indication comparison","BMI ≥30, or ≥27 with a weight-related comorbidity"],["WHO 2025 scope",bmi>=30?"Within the adult BMI ≥30 definition; recommendation is conditional":"Below WHO's adult obesity BMI ≥30 definition"],["Additional prescriber review flags",review?"Reported; require product-specific assessment":"None of the listed flags reported; this is not clearance"]],
      ["This comparison uses the adult semaglutide weight-management indication in CDSCO's CT-18 approvals list. It is not a universal licence for every weight-loss product. Verify the exact marketed Indian product label at prescribing; semaglutide should not be combined with another semaglutide product or GLP-1 receptor agonist.","Indian BMI obesity cut-offs of 23/25 must not be substituted for the 27/30 thresholds in this indication comparison. WHO's 2025 GLP-1 recommendation for adult obesity is conditional and excludes pregnancy.","MTC/MEN2, pancreatitis, gallbladder disease and eating disorders need product-specific clinical review; they are not all interchangeable absolute contraindications. An incomplete questionnaire cannot certify safety.","No drug choice, dose, prescription, expected weight-loss percentage or eligibility certificate is provided."],[CDSCO,WHO],pregnancy||threshold||review||unknown?"follow_up":"informational");
  },{age:40,weightKg:90,heightCm:170,weightRelatedCondition:"yes",isPregnant:false,isBreastfeeding:false,planningPregnancy:false,personalOrFamilyMtcOrMen2:false,historyPancreatitis:false,gallbladderDisease:false,eatingDisorder:false});

export const extendedTools=[calorie,ovulation,pregnancy,fib,syndrome,body,wh,hr,pack,burnout,pheno,pcos,thyroid,gut,weightLoss];
