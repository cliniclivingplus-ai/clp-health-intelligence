import { McpServer, type StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { getConsultationUrl } from "./config.js";
import { EGFR_TOOL_DESCRIPTION, SERVER_INSTRUCTIONS } from "./tools/egfr/metadata.js";
import { healthTools, runHealthTool } from "./tools/registry.js";
import { METABOLIC_UI_HTML } from "./web/generated.js";
import {
  calculateEgfr,
  egfrInputSchema,
  egfrOutputSchema,
  EGFR_UI_HTML,
  EGFR_UI_URI
} from "./tools/egfr/index.js";

export function createServer() {
  const server = new McpServer(
    { name: "clp-health-intelligence", version: "0.5.0" },
    { instructions: SERVER_INSTRUCTIONS }
  );

  registerAppResource(
    server,
    "egfr_result_card",
    EGFR_UI_URI,
    { title: "CLP eGFR result card", mimeType: RESOURCE_MIME_TYPE },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: RESOURCE_MIME_TYPE, text: EGFR_UI_HTML }]
    })
  );

  for (const tool of healthTools) {
    const resourceUri = `ui://clp-health-intelligence/${tool.slug}.html`;
    registerAppResource(server, `${tool.name}_card`, resourceUri,
      { title: tool.title, mimeType: RESOURCE_MIME_TYPE }, async (uri) => ({
        contents: [{ uri: uri.href, mimeType: RESOURCE_MIME_TYPE, text: METABOLIC_UI_HTML }]
      }));
    registerAppTool(server, tool.name, {
      title: tool.title, description: tool.description, inputSchema: tool.inputSchema as StandardSchemaWithJSON,
      outputSchema: tool.outputSchema as StandardSchemaWithJSON,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri } }
    }, async (args) => {
      const result = runHealthTool(tool.name, args);
      const url = getConsultationUrl();
      if (result.cta.show && url) result.cta.url = url;
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    });
  }

  registerAppTool(
    server,
    "calculate_egfr",
    {
      title: "CLP eGFR Calculator",
      description: EGFR_TOOL_DESCRIPTION,
      inputSchema: egfrInputSchema,
      outputSchema: egfrOutputSchema,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
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
