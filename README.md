# CLP Health Intelligence

## Milestone 1 — eGFR reference tool

This repository is the foundation for **CLP Health Intelligence**, Clinic Living Plus's AI-callable health-tool platform.

The first reference tool is `calculate_egfr`.

### Current architecture

```text
AI client
   ↓
MCP
   ↓
calculate_egfr
   ↓
validated eGFR engine
   ↓
structured clinical result
```

### Tool

`calculate_egfr` uses the 2021 race-free CKD-EPI creatinine equation for adults.

Inputs:
- `age` — 18 to 120 years
- `sex` — `male` or `female`
- `creatinine` — serum creatinine
- `creatinineUnit` — `mg/dL` or `umol/L`

Outputs include:
- eGFR in mL/min/1.73m²
- KDIGO G category
- normalized creatinine
- race coefficient flag (always false)
- clinical note
- educational disclaimer

### Run locally

Requirements: Node.js 20+.

```bash
npm install
npm test
npm run typecheck
npm run dev
```

The server currently uses stdio for local MCP testing. Remote deployment will be added after the reference tool and UI are stable.

### Next milestone

Add the MCP Apps interactive UI and link it to `calculate_egfr` without moving calculation logic into the frontend.

## Milestone 2 — eGFR MCP App UI

`calculate_egfr` is linked (`_meta.ui.resourceUri`) to a `ui://` card built with the official
`@modelcontextprotocol/ext-apps` SDK. The card only renders the tool result; severity, guidance and
the consultation-CTA decision come from `src/tools/egfr/policy.ts`.

- UI source: `ui-src/` -> bundled into `src/tools/egfr/ui.generated.ts` with `npm run build:ui`
  (re-run after editing anything in `ui-src/`).
- Consultation link: set `CLP_CONSULTATION_URL` (http/https). If unset, the button is disabled.
- Local test host: `npm run harness`, then open http://localhost:5173 (add `?inspect=1` for the
  same-origin mode used by automated checks).

## Milestone 3 — Remote MCP (Streamable HTTP, local)

> **Status: development / proof of concept.** Not deployed. No authentication yet. Do not treat as production clinical infrastructure.

One tool implementation, two transports. Both entry points call the same `createServer()` factory
(`src/server.ts`), so there is a single eGFR engine:

```text
src/index.ts  --> serveStdio(() => createServer())          (local development)
src/http.ts   --> createMcpHandler(() => createServer())    (Streamable HTTP, stateless)
                       |
                       +--> same tools, same calculate_egfr, same ui:// card
```

### Run

```bash
npm run dev:http      # http://localhost:3000/mcp, restarts on change
npm run start:http    # same, without watch
npm run dev           # stdio server (unchanged)
```

Endpoints: `GET /health` (liveness) and `POST /mcp` (MCP over Streamable HTTP).
The server is **stateless**: each request is served by a fresh server instance, no session id is issued,
and nothing is stored.

### Configuration (environment variables; see `.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Listening port |
| `HOST` | `127.0.0.1` | Interface (`0.0.0.0` only behind a platform proxy) |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,[::1]` | Accepted `Host` header hostnames |
| `ALLOWED_ORIGINS` | `localhost,127.0.0.1,[::1]` | Accepted `Origin` hostnames (requests without Origin are accepted) |
| `MAX_BODY_BYTES` | `65536` | Max request body; larger gets 413 |
| `RATE_LIMIT_PER_MINUTE` | `120` | Per-client limit on `/mcp` (per instance); 429 when exceeded |
| `TRUST_PROXY` | `false` | Use `X-Forwarded-For` for the client address (only behind a trusted proxy) |
| `CLP_CONSULTATION_URL` | unset | Consultation button target; button disabled when unset |

`.env` is git-ignored and loaded automatically if present (`--env-file-if-exists`). No secrets are required today.

### Security notes

- Host and Origin validation (DNS-rebinding protection), body-size limit, JSON content-type check, rate limiting, request timeouts.
- **Health inputs are never persisted or logged.** No database. Logs are one JSON line per request with only: timestamp, request id, HTTP method, path, MCP method, tool name, status and duration.
- Authentication is not enabled; `createHttpApp({ authenticate })` is the extension point for adding it later.
- Terminate TLS in front of this process (platform/proxy); the app itself speaks plain HTTP.

### Tests and harness

```bash
npm test              # all tests: engine, presentation, stdio, and HTTP (src/http-app.ts)
npm run typecheck
MCP_URL=http://127.0.0.1:3000/mcp npm run harness   # browser card host, driving the HTTP server
```

## Production build and Render deployment (prepared, not yet deployed)

> Proof of concept: no authentication, synthetic data only, no custom domain. Do not use with real patient data.

### Build and start (compiled JavaScript, no dev tooling at runtime)

```bash
npm ci --include=dev   # dev dependencies are needed only to compile
npm run build          # tsc -> dist/
npm start              # node dist/http.js  (HTTP: /health and /mcp)
npm run start:stdio    # compiled stdio server (node dist/index.js)
```

Development commands are unchanged: `npm test`, `npm run typecheck`, `npm run dev:http`, `npm run start:http`, `npm run dev`.
At runtime only production dependencies are required (verified with `npm ci --omit=dev`).
`npm run build:ui` is only needed after editing `ui-src/`; the generated card is committed.

### Deploying to Render (manual steps; nothing here has been run)

Render deploys from a Git repository, so first put the project in a **private** repository (see the pre-push checklist below).

1. Render dashboard -> New -> Web Service (or Blueprint, using `render.yaml`) -> connect the private repository.
2. Settings (already encoded in `render.yaml`):
   - Runtime: Node. Environment variable `NODE_VERSION=24`.
   - Build command: `npm ci --include=dev && npm run build`
   - Start command: `npm start`
   - Health check path: `/health`
   - Instance type: **Starter** (the free tier idles and spins down, which can break a connector's first handshake).
3. Environment variables:

   | Variable | Value |
   |---|---|
   | `HOST` | `0.0.0.0` |
   | `PORT` | provided by Render; do not set |
   | `TRUST_PROXY` | `false` (leave off for the first deployment) |
   | `MAX_BODY_BYTES` / `RATE_LIMIT_PER_MINUTE` | `65536` / `120` |
   | `CLP_CONSULTATION_URL` | leave unset until the real booking link is approved (button stays disabled) |
   | `ALLOWED_HOSTS` | not needed: Render's `RENDER_EXTERNAL_HOSTNAME` is allowed automatically. Set it only to add extra hostnames (e.g. a custom domain later). |

4. After deploy, the endpoint is `https://<service>.onrender.com/mcp`.

### Pre-push checklist (before creating the repository)

- [ ] No `.env` file exists or is staged (it is git-ignored; only `.env.example` is committed).
- [ ] No real consultation URL, API keys, tokens or passwords in any file.
- [ ] No patient or real health data anywhere (tests use synthetic values only).
- [ ] Repository is **private**.
- [ ] `dist/` and `node_modules/` are not committed (git-ignored).

### Deployment verification checklist (after Render reports "Live")

Replace `H` with `https://<service>.onrender.com`.

- [ ] `GET H/health` -> 200 `{"status":"ok","service":"clp-health-intelligence"}`
- [ ] `initialize` and `tools/list` over `POST H/mcp` succeed; `calculate_egfr` lists `_meta.ui.resourceUri = ui://clp-health-intelligence/egfr.html`
- [ ] `calculate_egfr` age 45, male, 1.5 mg/dL -> `58` / `G3a`; 132.6 umol/L -> `58` / `G3a`
- [ ] age 17 -> `isError: true`, no result
- [ ] `resources/read` for the `ui://` URI -> mime type `text/html;profile=mcp-app`
- [ ] Foreign `Origin` -> 403; wrong `Content-Type` -> 415; unknown path -> 404
- [ ] Render logs show only method, MCP method, tool name, status and timing (no health values)
- [ ] Card renders: `MCP_URL=H/mcp npm run harness`, open http://127.0.0.1:5173/
- [ ] Only then connect an AI host (Claude first), using synthetic data.

Smoke test with the SDK client (from the project folder):

```bash
MCP_URL=H/mcp node --input-type=module -e "import {Client,StreamableHTTPClientTransport} from '@modelcontextprotocol/client'; const c=new Client({name:'smoke',version:'0'}); await c.connect(new StreamableHTTPClientTransport(new URL(process.env.MCP_URL))); console.log((await c.listTools()).tools.map(t=>t.name)); const r=await c.callTool({name:'calculate_egfr',arguments:{age:45,sex:'male',creatinine:1.5}}); console.log(r.structuredContent.egfr, r.structuredContent.category); await c.close();"
```

### Known Render-specific points

- `TRUST_PROXY=false`: all traffic shares one rate-limit bucket (conservative). Proper client-IP handling is deferred.
- The in-memory rate limiter is per instance and resets on restart; scale beyond one instance later with an outer layer.
- Starter instances stay up; free instances spin down after idle and may cause slow first requests.
