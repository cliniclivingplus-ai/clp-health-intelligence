import { McpServer } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { getConsultationUrl } from "./config.js";
import {
  calculateEgfr,
  egfrInputSchema,
  egfrOutputSchema,
  EGFR_UI_HTML,
  EGFR_UI_URI
} from "./tools/egfr/index.js";

export function createServer() {
  const server = new McpServer({
    name: "clp-health-intelligence",
    version: "0.3.0"
  });

  registerAppResource(
    server,
    "egfr_result_card",
    EGFR_UI_URI,
    { title: "CLP eGFR result card", mimeType: RESOURCE_MIME_TYPE },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: RESOURCE_MIME_TYPE, text: EGFR_UI_HTML }]
    })
  );

  registerAppTool(
    server,
    "calculate_egfr",
    {
      title: "CLP eGFR Calculator",
      description: "Calculate adult estimated glomerular filtration rate (eGFR) from age, sex, and serum creatinine using the 2021 race-free CKD-EPI creatinine equation. Use when a user provides these values or asks about kidney filtration. Do not use this tool to diagnose chronic kidney disease.",
      inputSchema: egfrInputSchema,
      outputSchema: egfrOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      },
      _meta: {
        ui: { resourceUri: EGFR_UI_URI }
      }
    },
    async (args) => {
      try {
        const result = calculateEgfr(args);
        const url = getConsultationUrl();
        if (result.cta.show && url) result.cta.url = url;
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : "Unable to calculate eGFR." }],
          isError: true
        };
      }
    }
  );

  return server;
}
