# Release 0.5.0 — 18 health tools, 11 October 2026

Deployed successfully to https://clp-health-intelligence.vercel.app/.
Deployment: `dpl_HBR88gBAjJCmaTcyriqoTvmCUBVd`.

- Added `/tool4` through `/tool18` for the 15 requested calculators and assessments.
- Existing `/tool1`–`/tool3` retained; MCP exposes all 18 plus the existing eGFR tool.
- Shared server-side calculation engine, website forms and MCP Apps result resources.
- Primary references, formula assumptions, unit validation and limitations included in results.
- 68 automated tests passed; local TypeScript and production compilation passed.
- All 18 live tools/pages passed the remote MCP/API parity smoke test and resource reads.
- Browser checks covered IVF fields, CBI array responses and PhenoAge. Representative
  production cards rendered in the official AppBridge harness. Live library verified
  at desktop/mobile widths without horizontal overflow.
- Clinical sign-off and actual ChatGPT/Claude conversation integration remain pending.
- Vercel's builder still emits TS2688 for node types during transpilation; it completed
  deployment and the live function passed verification. Local type checking is clean.
- Source changes are local and were uploaded via Vercel CLI; GitHub has not been synced.

## Earlier milestones

# CLP Health Intelligence — Build Status

## Previous status — 11 October 2026

Version 0.4.0: eGFR plus Indian BMI, HbA1c conversion and original IDRS are available
through MCP. The three new calculator pages are live at `/tool1`, `/tool2`, `/tool3`.
52 tests pass; typecheck and production build pass. Live MCP calls, website/API
parity, resource delivery and all three interactive MCP cards were verified.
Clinical sign-off and testing in an actual AI conversation remain pending.
See README and CLINICAL_METHODS.md for current details; earlier milestone notes
below are historical.

## Milestone 1: eGFR reference tool

Status: **Complete (see README for Milestones 2 and 3)**

### Complete
- Project naming: CLP Health Intelligence
- MCP server foundation
- `calculate_egfr` tool
- 2021 race-free CKD-EPI creatinine equation
- Adult input validation
- Creatinine unit conversion
- KDIGO G category mapping
- Structured output schema
- Clinical note + educational disclaimer
- Automated test suite

### Local verification

From the project folder:

```bash
npm install
npm test
npm run typecheck
```

Expected: all eGFR tests pass and TypeScript reports no errors.

### Next

Milestone 2: MCP Apps interactive UI for the eGFR result.
