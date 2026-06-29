---
quick_id: 260629-psu
slug: main-sankey-should-exclude-account-nodes
status: complete
completed: 2026-06-29
---

# Quick Task 260629-psu Summary

Main Sankey now defaults to the intended simple household flow and excludes account nodes, account links, and manual account transfers from the chart. Account-flow projection remains available through `buildSankeyData(..., { includeAccountFlow: true })`, and Main's render orchestrator uses that explicit path only for the network helper.

## Changed Files

- `apps/main/modules/sankey-builder.js`
- `apps/main/modules/render-orchestrator.js`
- `tests/step1.spec.ts`

## Verification

- `npm run check` — passed
- `npx playwright test tests/step1.spec.ts --reporter=list` — passed, 69 tests
- `npx playwright test tests/account-map.spec.ts --reporter=list` — passed, 8 tests

## Notes

- This restores the Phase 10.7 decision that the Step 1/Main Sankey should show a concise `수입 -> 총수입 -> 소비/저축/투자` household flow.
- Account Map remains the destination for relationship-focused account management.
