import { metabolicTools, runMetabolicTool, type MetabolicResult } from "./metabolic.js";
import { extendedTools } from "./extended.js";
export const healthTools = [...metabolicTools, ...extendedTools];
export function runHealthTool(name: string, input: unknown): MetabolicResult {
  const tool = extendedTools.find(t => t.name === name);
  return tool ? tool.calculate(input) : runMetabolicTool(name, input);
}
