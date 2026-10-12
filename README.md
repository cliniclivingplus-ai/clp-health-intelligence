# CLP Health Intelligence

## Eighteen health tools — live

- Indian adult BMI: https://clp-health-intelligence.vercel.app/tool1 — `calculate_bmi`
- HbA1c to estimated average glucose: https://clp-health-intelligence.vercel.app/tool2 — `calculate_hba1c`
- Original Indian Diabetes Risk Score: https://clp-health-intelligence.vercel.app/tool3 — `calculate_idrs`
- Calorie calculator: `/tool4` — `calculate_calories`
- Ovulation calculator: `/tool5` — `calculate_ovulation`
- Pregnancy due date: `/tool6` — `calculate_due_date`
- FIB-4 liver score: `/tool7` — `calculate_fib4`
- Metabolic syndrome: `/tool8` — `check_metabolic_syndrome`
- Body fat: `/tool9` — `calculate_body_fat`
- Waist-to-height ratio: `/tool10` — `calculate_waist_height`
- Heart rate zones: `/tool11` — `calculate_heart_rate_zones`
- Pack-year smoking: `/tool12` — `calculate_pack_years`
- Burnout (CBI): `/tool13` — `assess_burnout`
- Biological age (clinical PhenoAge): `/tool14` — `calculate_phenoage`
- PCOS symptoms: `/tool15` — `check_pcos_symptoms`
- Thyroid symptoms: `/tool16` — `check_thyroid_symptoms`
- Gut symptoms: `/tool17` — `assess_gut_symptoms`
- Medical weight-loss suitability screen: `/tool18` — `assess_weight_loss_medication`
- Tool library: https://clp-health-intelligence.vercel.app/
- Shared MCP endpoint (18 tools plus existing eGFR): https://clp-health-intelligence.vercel.app/mcp

Website pages submit to `POST /api/calculate`. That API and the MCP server call the
same input-validated functions through `src/tools/registry.ts`, with engines in
`src/tools/metabolic.ts` and `src/tools/extended.ts`. Frontends render their results;
they do not contain medical calculations. The optional BMI stage is a provisional
2025 staging screen; missing clinical details do not produce a stage diagnosis.
The IDRS uses the original 2005 exercise/work categories, not later variants.
See [CLINICAL_METHODS.md](CLINICAL_METHODS.md) for sources, limits and pending clinical sign-off.

Verification on 11 October 2026: 68 tests passed; local TypeScript and production build
passed. All 18 tools were called through local HTTP MCP, compared against their
website API outputs, and their MCP Apps resources read. Formula tests cover clinical
boundaries, unit handling, age restrictions, date arithmetic and CBI reverse scoring.
Browser checks include conditional IVF fields, CBI response arrays and PhenoAge inputs.
All 18 tools and pages also passed the production smoke check with website/MCP parity
and readable MCP Apps resources. Representative due-date, burnout, PhenoAge, PCOS
and weight-loss cards rendered through the official AppBridge host connected to live MCP.
The deployed library was checked at 1280px and 390px without horizontal overflow.
This does not establish clinical validation or confirm a ChatGPT/Claude conversation integration.

Symptom checkers provide guideline-based assessment prompts, not invented diagnostic
scores or probabilities. The medicine screen compares an identified CDSCO semaglutide
indication; it does not prescribe or certify suitability. PhenoAge is a research model
with explicit printed coefficient precision and units, not a literal age or lifespan.

`npm run build:ui` rebuilds both the existing eGFR card and new website/MCP card
bundles. Run it after changing `ui-src/`. The harness's Tool selector offers synthetic
examples for all tools. After changing sample fixtures, run `npm run build` then
`node scripts/prepare-samples.mjs`. Use `MCP_URL` to drive a deployed endpoint.
Source is in the private GitHub repository `cliniclivingplus-ai/clp-health-intelligence`;
deployments to Vercel are made with the CLI (`vercel --prod`).

## Vercel hosting

Live and smoke-tested on 11 October 2026 at
`https://clp-health-intelligence.vercel.app/mcp`, in the `cliniclivingplus` team.
Deployment: `dpl_HBR88gBAjJCmaTcyriqoTvmCUBVd` (eighteen tools and pages, version 0.5.0).

Vercel uses `api/index.ts`, which exports the shared HTTP application's request
listener through a Node function. `vercel.json` explicitly selects `@vercel/node`
and routes requests to it, preserving `/health` and `/mcp`. `src/http.ts` / `dist/http.js`
remain as a generic Node entry point for local runs and self-hosting. The raw body stream is preserved so the shared
handler remains responsible for body-size and JSON validation.

Verified live: health, MCP discovery, both creatinine units, invalid age rejection,
the MCP Apps UI resources and rejection of foreign Origins. Representative cards were
visually checked in the AppBridge harness; actual AI conversation testing remains
pending. Local TypeScript checks pass; the Vercel
builder emitted a Node type-definition diagnostic during transpilation, but produced
the working function. Build-tool compatibility should be reviewed on the next update.

Exact Vercel deployment, branch and production hostnames are allowed automatically.
For a custom domain, add it to `ALLOWED_HOSTS` and `ALLOWED_ORIGINS`. Exact platform
hostnames are also allowed Origins so these calculator pages can call their own API;
unrelated domains are rejected.

The in-memory rate limiter is a per-instance safeguard, not a shared quota. With
`TRUST_PROXY=false`, callers may share a bucket behind the platform proxy. Use a
platform firewall or shared rate limiter before relying on global rate limiting.
The consultation button remains disabled until `CLP_CONSULTATION_URL` is configured.

Deploy from this directory to the `cliniclivingplus` team:

```powershell
vercel deploy --yes --prod --scope cliniclivingplus
node scripts/smoke-remote.mjs https://your-production-host
```

Run `npm run build` before the smoke check. It uses synthetic values and verifies
all 18 pages and tools, website/MCP parity, health, discovery, both creatinine units,
invalid age rejection, result card resources and Origin protection.
It does not verify visual rendering in an AI host.

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

## Production build and Vercel deployment

> Proof of concept: no authentication, synthetic data only, no custom domain. Do not use with real patient data.

### Build and start (compiled JavaScript, no dev tooling at runtime)

```bash
npm ci --include=dev   # dev dependencies are needed only to compile
npm run build          # tsc -> dist/
npm start              # node dist/http.js  (HTTP: /health and /mcp), for local or self-hosted runs
npm run start:stdio    # compiled stdio server (node dist/index.js)
```

Development commands: `npm test`, `npm run typecheck`, `npm run dev:http`, `npm run start:http`, `npm run dev`.
`npm run build:ui` is only needed after editing `ui-src/`; the generated cards are committed.

### Deploying to Vercel

The project is linked to the Vercel project `clp-health-intelligence` (`.vercel/` is git-ignored).

```bash
npm test && npm run typecheck && npm run build   # all must pass first
vercel --prod                                      # deploy to production
```

Connector URL for AI hosts (the path is required): `https://clp-health-intelligence.vercel.app/mcp`.

Environment variables (Vercel project settings; none are secrets today):

| Variable | Value |
|---|---|
| `TRUST_PROXY` | `false` until trusted client-IP handling is added |
| `MAX_BODY_BYTES` / `RATE_LIMIT_PER_MINUTE` | `65536` / `120` |
| `CLP_CONSULTATION_URL` | leave unset until the real booking link is approved (button stays disabled) |
| `ALLOWED_HOSTS` | not needed for Vercel hostnames (`VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_BRANCH_URL` are allowed automatically). Add a custom domain here later. |

### Pre-push checklist

- [ ] No `.env` file exists or is staged (git-ignored; only `.env.example` is committed).
- [ ] No real consultation URL, API keys, tokens or passwords in any file.
- [ ] No patient or real health data anywhere (tests use synthetic values only).
- [ ] Repository is **private**.
- [ ] `dist/`, `node_modules/` and `.vercel/` are not committed (git-ignored).

### Deployment verification checklist

Replace `H` with `https://clp-health-intelligence.vercel.app`.

- [ ] `GET H/health` -> 200 `{"status":"ok","service":"clp-health-intelligence"}`
- [ ] `initialize` and `tools/list` over `POST H/mcp` succeed; each tool lists a `ui://` resource
- [ ] `calculate_egfr` age 45, male, 1.5 mg/dL -> `58` / `G3a`; 132.6 umol/L -> `58` / `G3a`
- [ ] age 17 -> `isError: true`, no result
- [ ] `resources/read` for a `ui://` URI -> mime type `text/html;profile=mcp-app`
- [ ] Foreign `Origin` -> 403; wrong `Content-Type` -> 415; unknown path -> 404
- [ ] Vercel function logs show only method, MCP method, tool name, status and timing (no health values)
- [ ] Card renders: `MCP_URL=H/mcp npm run harness`, open http://127.0.0.1:5173/
- [ ] `node scripts/smoke-remote.mjs H` passes
- [ ] Only then connect an AI host, using synthetic data.

### Known points

- `TRUST_PROXY=false`: the in-memory rate limiter cannot identify individual visitors behind the platform proxy. Proper client-IP handling is required before public launch.
- The rate limiter is per serverless instance and resets on cold start; use a platform-level layer for real abuse protection.
