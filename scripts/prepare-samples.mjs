// Development-only synthetic inputs. No clinical engine code is shipped to the harness browser.
import { writeFile, readFile } from "node:fs/promises";
import { extendedTools } from "../dist/tools/extended.js";
await writeFile(new URL("../harness/samples.ts",import.meta.url),"export const extendedSamples: Record<string, Record<string, unknown>> = "+JSON.stringify(Object.fromEntries(extendedTools.map(t=>[t.name,t.example])),null,2)+";\n");
const path=new URL("../harness/index.html",import.meta.url);
const html=await readFile(path,"utf8");
const options=extendedTools.map(t=>`<option value="${t.name}">${t.title} (synthetic sample)</option>`).join("");
await writeFile(path,html.replace(/(<select id="tool">)(.*?)(<\/select>)/s,(_,start,existing,end)=>start+existing.replace(/<option value="(?:calculate_calories|calculate_ovulation|calculate_due_date|calculate_fib4|check_metabolic_syndrome|calculate_body_fat|calculate_waist_height|calculate_heart_rate_zones|calculate_pack_years|assess_burnout|calculate_phenoage|check_pcos_symptoms|check_thyroid_symptoms|assess_gut_symptoms|assess_weight_loss_medication)">.*?<\/option>/gs,"")+options+end));
