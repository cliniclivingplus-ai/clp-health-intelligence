# CLP Health Intelligence — Build Status

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
