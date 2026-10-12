import type { IncomingMessage, ServerResponse } from "node:http";
import { createHttpApp } from "../src/http-app.js";
import { loadHttpConfig } from "../src/config.js";

const app = createHttpApp({ config: loadHttpConfig() });
const listener = app.server.listeners("request")[0];

// Preserve the raw stream for the shared size-limited JSON parser.
export const config = { api: { bodyParser: false } };
export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await listener(request, response);
}
