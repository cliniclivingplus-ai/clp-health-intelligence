import test from "node:test";
import assert from "node:assert/strict";
import { extendedTools } from "../src/tools/extended.js";
import { runHealthTool } from "../src/tools/registry.js";
const tool=(name:string)=>extendedTools.find(t=>t.name===name)!;
const run=(name:string,changes:Record<string,unknown>={})=>runHealthTool(name,{...tool(name).example,...changes});
const detail=(result:ReturnType<typeof run>,label:string)=>result.details.find(d=>d.label===label)?.value;

test("Mifflin known male/female examples and reference protein are separate from measured weight",()=>{
  const male=run("calculate_calories");assert.equal(male.displayValue,"2230");
  assert.equal(detail(male,"Resting energy estimate"),"1593 kcal/day");
  assert.equal(detail(male,"Healthy-adult protein reference"),"54 g/day at 0.83 g/kg");
  assert.equal(run("calculate_calories",{sex:"female"}).displayValue,"1997");
  for(const patch of [{age:18},{age:79},{isPregnant:true},{isBreastfeeding:true},{needsSpecialistNutrition:true}])assert.throws(()=>run("calculate_calories",patch));
});
test("calendar estimates preserve day arithmetic and withhold unsuitable predictions",()=>{
  assert.equal(run("calculate_ovulation").displayValue,"2026-10-15");
  assert.equal(detail(run("calculate_ovulation"),"Estimated fertile window"),"2026-10-10 to 2026-10-15");
  assert.equal(run("calculate_ovulation",{regularCycles:false}).displayValue,"Not reliable");
  assert.equal(run("calculate_ovulation",{cycleLengthDays:39}).displayValue,"Not reliable");
  assert.equal(run("calculate_ovulation",{age:35,monthsTrying:6}).severity,"follow_up");
  assert.equal(run("calculate_ovulation",{age:34,monthsTrying:6}).severity,"informational");
  assert.equal(run("calculate_ovulation",{age:41,monthsTrying:0}).severity,"follow_up");
});
test("LMP, conception and both embryo ages agree for equivalent dates across leap day",()=>{
  const date="2024-02-01";
  const lmp=runHealthTool("calculate_due_date",{method:"lmp",lmp:date});
  assert.equal(lmp.displayValue,"2024-11-07");
  for(const args of [{method:"conception",conceptionDate:"2024-02-15"},{method:"ivf",transferDate:"2024-02-18",embryoAgeDays:3},{method:"ivf",transferDate:"2024-02-20",embryoAgeDays:5}])assert.equal(runHealthTool("calculate_due_date",args).displayValue,lmp.displayValue);
  for(const bad of ["2026-02-29","2024-02-30","2024-13-01","01-02-2024"])assert.throws(()=>runHealthTool("calculate_due_date",{method:"lmp",lmp:bad}));
  assert.throws(()=>runHealthTool("calculate_due_date",{method:"ivf",transferDate:date,embryoAgeDays:4}));
});
test("ACOG redating thresholds are strict and change at the correct gestational boundaries",()=>{
  const shifts:[[number,number],number][]=[[[8,6],5],[[9,0],7],[[13,6],7],[[14,0],7],[[15,6],7],[[16,0],10],[[21,6],10],[[22,0],14],[[27,6],14],[[28,0],21]];
  const date=(n:number)=>new Date(Date.UTC(2026,0,1)+n*86400000).toISOString().slice(0,10);
  for(const [[weeks,days],threshold] of shifts){
    for(const diff of [threshold,threshold+1]){
      const r=runHealthTool("calculate_due_date",{method:"ultrasound",scanDate:date(weeks*7+days+diff),scanWeeks:weeks,scanDays:days,lmp:"2026-01-01"});
      assert.equal(detail(r,"ACOG review threshold"),`More than ${threshold} days at this scan gestation`);
      assert.ok(detail(r,"Redating comparison")!.startsWith(diff>threshold?"Discrepancy exceeds":"Does not exceed"));
    }
  }
});
test("FIB-4 equation and exact boundary classifications, age >65 and under35 limitations",()=>{
  assert.equal(run("calculate_fib4").displayValue,"1.19");
  for(const [age,threshold] of [[65,1.3],[66,2]]){
    assert.equal(run("calculate_fib4",{age,astUL:threshold*200*10/age,altUL:100}).category,"Indeterminate screening result");
    assert.equal(run("calculate_fib4",{age,astUL:(threshold-.001)*200*10/age,altUL:100}).category,"Lower screening risk");
  }
  assert.equal(run("calculate_fib4",{age:50,astUL:106.8,altUL:100}).category,"Higher screening risk");
  assert.equal(run("calculate_fib4",{age:34}).category,"Age limits interpretation");
  for(const patch of [{altUL:0},{platelets109L:0},{acutelyIll:true},{masldContext:false}])assert.throws(()=>run("calculate_fib4",patch));
});
test("harmonised components: three required, strict HDL, inclusive glucose/BP/TG and medications",()=>{
  assert.equal(run("check_metabolic_syndrome").displayValue,"3");
  const low={waistCm:89,triglyceridesMgDl:149,hdlMgDl:40,systolicMmHg:129,diastolicMmHg:84,fastingGlucoseMgDl:99};
  assert.equal(run("check_metabolic_syndrome",low).displayValue,"0");
  for(const patch of [{waistCm:90},{triglyceridesMgDl:150},{hdlMgDl:39.999},{systolicMmHg:130},{diastolicMmHg:85},{fastingGlucoseMgDl:100},{treatedHighTriglycerides:true},{treatedLowHdl:true},{treatedHypertension:true},{treatedHighGlucose:true}])assert.equal(run("check_metabolic_syndrome",{...low,...patch}).displayValue,"1");
  assert.equal(run("check_metabolic_syndrome",{...low,sex:"female",waistCm:80,hdlMgDl:49.9}).displayValue,"2");
  assert.throws(()=>run("check_metabolic_syndrome",{fastingSample:false}));
  assert.throws(()=>run("check_metabolic_syndrome",{systolicMmHg:80,diastolicMmHg:90}));
  assert.equal(run("check_metabolic_syndrome",{systolicMmHg:180}).severity,"concerning");
});
test("Navy equation converts to inches and rejects invalid/implausible anatomy without clamping",()=>{
  const male=86.010*Math.log10((90-38)/2.54)-70.041*Math.log10(175/2.54)+36.76;
  assert.equal(run("calculate_body_fat").displayValue,male.toFixed(1));
  const female=163.205*Math.log10((75+100-33)/2.54)-97.684*Math.log10(165/2.54)-78.387;
  assert.equal(run("calculate_body_fat",{sex:"female",heightCm:165,neckCm:33,circumferenceCm:75,hipCm:100}).displayValue,female.toFixed(1));
  assert.throws(()=>run("calculate_body_fat",{sex:"female"}));
  assert.throws(()=>run("calculate_body_fat",{neckCm:40,circumferenceCm:40}));
  assert.throws(()=>run("calculate_body_fat",{heightCm:250,neckCm:38,circumferenceCm:39}));
});
test("NICE ratio categories use raw values and enforce BMI <35 applicability",()=>{
  assert.equal(run("calculate_waist_height",{waistCm:68}).category,"Healthy central-adiposity band");
  assert.ok(run("calculate_waist_height",{waistCm:67.9}).category.startsWith("Below"));
  assert.equal(run("calculate_waist_height",{waistCm:84.999}).category,"Healthy central-adiposity band");
  assert.equal(run("calculate_waist_height").category,"Increased central adiposity");
  assert.equal(run("calculate_waist_height",{waistCm:102}).category,"High central adiposity");
  assert.ok(run("calculate_waist_height",{heightCm:200,weightKg:140}).category.includes("withheld"));
});
test("Tanaka and ACSM HRmax/HRreserve categories are distinct; unsafe contexts withhold zones",()=>{
  const r=run("calculate_heart_rate_zones");assert.equal(r.displayValue,"180");
  assert.equal(detail(r,"Moderate · 64–76% HRmax"),"115–137 beats/min");
  assert.equal(detail(r,"Moderate · 40–59% HR reserve"),"108–131 beats/min");
  for(const patch of [{heartRateAffectingMedication:true},{heartCondition:true},{isPregnant:true},{exerciseSymptoms:true}]){
    const limited=run("calculate_heart_rate_zones",patch);assert.equal(limited.displayValue,"Clinical review");assert.equal(limited.details.length,1);
  }
  assert.throws(()=>run("calculate_heart_rate_zones",{age:82}));
});
test("pack-years and USPSTF exact age, exposure and quit boundaries",()=>{
  assert.equal(run("calculate_pack_years").displayValue,"25.00");
  for(const age of [50,80])assert.ok(run("calculate_pack_years",{age,yearsSmoked:20}).category.startsWith("Meets"));
  for(const patch of [{age:49},{age:81},{yearsSmoked:19.99},{yearsSinceQuit:15}])assert.ok(run("calculate_pack_years",patch).category.startsWith("Does not"));
  assert.ok(run("calculate_pack_years",{yearsSinceQuit:14.999}).category.startsWith("Meets"));
  assert.throws(()=>runHealthTool("calculate_pack_years",{age:55,cigarettesPerDay:20,yearsSmoked:25,currentlySmoking:false}));
  assert.throws(()=>run("calculate_pack_years",{yearsSmoked:50,yearsSinceQuit:10}));
});
test("CBI computes separate means and reverses only work item7; never invents severity cutoffs",()=>{
  const r=run("assess_burnout");assert.equal(r.displayValue,"50");assert.equal(detail(r,"Work-related exhaustion"),"42.9 / 100");
  assert.equal(detail(run("assess_burnout",{work:[0,0,0,0,0,0,100]}),"Work-related exhaustion"),"0 / 100");
  assert.equal(detail(run("assess_burnout",{work:[100,100,100,100,100,100,0]}),"Work-related exhaustion"),"100 / 100");
  assert.equal(run("assess_burnout",{personal:[100,100,100,100,100,100]}).severity,"informational");
  for(const patch of [{personal:[50,50]},{personal:[1,50,50,50,50,50]},{work:[50,50,50,50]}])assert.throws(()=>run("assess_burnout",patch));
});
test("PhenoAge matches independently evaluated original mortality transform with correct CRP units",()=>{
  const xb=-19.9067-.0336*43+.0095*80+.1953*5+.0954*Math.log(.1)-.012*30+.0268*90+.3306*13+.0019*70+.0554*6+.0804*50;
  const mortality=1-Math.exp(-Math.exp(xb)*(Math.exp(120*.0076927)-1)/.0076927);
  const expected=141.50225+Math.log(-.00553*Math.log(1-mortality))/.090165;
  assert.equal(run("calculate_phenoage").displayValue,expected.toFixed(1));
  assert.ok(Number(run("calculate_phenoage",{crpMgL:10}).displayValue)>Number(run("calculate_phenoage").displayValue));
  assert.ok(Number.isFinite(Number(run("calculate_phenoage",{creatinineUmolL:2000,glucoseMmolL:50,crpMgL:500,wbc109L:100,alkalinePhosphataseUL:2000}).displayValue)));
  assert.throws(()=>run("calculate_phenoage",{crpMgL:0}));assert.throws(()=>run("calculate_phenoage",{age:19}));
});
test("PCOS cycle criteria respect post-menarche timing and do not diagnose from symptoms",()=>{
  assert.equal(detail(run("check_pcos_symptoms"),"Cycle pattern"),"Meets a guideline irregular-cycle definition");
  const base={age:18,yearsSinceMenarche:2,shortestCycleDays:21,longestCycleDays:45,cyclesPerYear:8,excessCoarseHair:false};
  assert.ok(detail(run("check_pcos_symptoms",base),"Cycle pattern")!.startsWith("Does not"));
  assert.ok(detail(run("check_pcos_symptoms",{...base,longestCycleDays:46}),"Cycle pattern")!.startsWith("Meets"));
  assert.ok(detail(run("check_pcos_symptoms",{...base,yearsSinceMenarche:3,longestCycleDays:36}),"Cycle pattern")!.startsWith("Meets"));
  assert.equal(run("check_pcos_symptoms",{usesHormonalContraception:true}).displayValue,"Limited interpretation");
  assert.equal(run("check_pcos_symptoms",{rapidVirilisation:true}).severity,"concerning");
});
test("thyroid and gut warning signs override symptom assessment and produce no diagnostic percentage",()=>{
  assert.equal(run("check_thyroid_symptoms",{severeCurrentSymptoms:true}).displayValue,"Urgent care");
  assert.equal(run("assess_gut_symptoms",{severeCurrentSymptoms:true}).displayValue,"Urgent care");
  assert.equal(run("assess_gut_symptoms",{bloodInStool:true}).displayValue,"Medical assessment");
  assert.equal(run("assess_gut_symptoms").displayValue,"Bowel assessment");
  for(const n of ["check_thyroid_symptoms","assess_gut_symptoms","check_pcos_symptoms"])assert.ok(!run(n).displayValue.includes("%"));
});
test("medicine indication screen keeps 27/30 separate from Indian obesity bands and prioritises pregnancy",()=>{
  const base={heightCm:200,weightRelatedCondition:"no"};
  assert.ok(run("assess_weight_loss_medication",{...base,weightKg:100}).category.startsWith("Below"));
  assert.ok(run("assess_weight_loss_medication",{...base,weightKg:108,weightRelatedCondition:"yes"}).category.startsWith("Meets"));
  assert.ok(run("assess_weight_loss_medication",{...base,weightKg:119.999}).category.startsWith("Below"));
  assert.ok(run("assess_weight_loss_medication",{...base,weightKg:120}).category.startsWith("Meets"));
  assert.equal(run("assess_weight_loss_medication",{...base,weightKg:108,weightRelatedCondition:"unknown"}).category,"Comorbidity information needed");
  assert.ok(run("assess_weight_loss_medication",{isPregnant:true}).category.startsWith("Pregnancy"));
});
