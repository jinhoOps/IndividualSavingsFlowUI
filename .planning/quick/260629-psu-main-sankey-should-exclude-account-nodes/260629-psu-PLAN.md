---
quick_id: 260629-psu
slug: main-sankey-should-exclude-account-nodes
status: planned
created: 2026-06-29
---

# Quick Task 260629-psu: Main Sankey should exclude account nodes

## Objective

Restore the intended Main household-flow Sankey contract: the chart stays simple and excludes account nodes, account allocation links, and account transfers. Account relationship data remains available for the dedicated Account Map and network-style helpers through explicit account-flow projection.

## Tasks

1. Update `apps/main/modules/sankey-builder.js` so the default Sankey path renders income through `총수입` directly to spending, savings, investment, debt, and surplus destinations.
2. Keep account-flow calculations available behind an explicit `includeAccountFlow` option and use that path from `apps/main/modules/render-orchestrator.js` for the network helper.
3. Update `tests/step1.spec.ts` expectations so default Main Sankey excludes account labels while explicit account-flow compatibility remains covered.

## Verification

- `npm run check`
- `npx playwright test tests/step1.spec.ts --reporter=list`
- `npx playwright test tests/account-map.spec.ts --reporter=list`
