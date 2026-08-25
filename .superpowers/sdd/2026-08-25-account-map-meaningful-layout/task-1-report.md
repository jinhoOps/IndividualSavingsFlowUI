# Task 1 Report — Canonical Account-First Graph Layout

## Implementation summary

- Added `AccountMapGraph.primaryIncomeLocationId` and `GraphNode.isPrimaryIncome`.
- Selects a valid primary income location from all active income links by total amount, normalized short name, then location ID; overview uses it as the income representative independent of link storage order.
- Replaced the purpose/account layout branch with one deterministic account-first comparator and geometry: locations left on desktop, purposes right, status centered, and the same order in the mobile grid.
- Kept `AccountMapApplied.layout` entirely outside this pure layout implementation; no storage writes, coordinates, arrows, synthetic edges, duplicate nodes, or transfer behavior were added.

## Files changed

- `src/account-map/ui/mapLayout.ts`
- `tests/unit/account-map/mapLayout.test.ts`

## TDD evidence

- RED: `npx vitest run tests/unit/account-map/mapLayout.test.ts` — 15 tests run, 11 failed. Expected failures covered missing primary-income metadata, overview storage-order selection, and obsolete layout-argument geometry.
- GREEN: `npx vitest run tests/unit/account-map/mapLayout.test.ts` — 1 test file passed; 15 tests passed.

## Exact verification results

- `git diff --check` — passed.
- `npx vitest run tests/unit/account-map/mapLayout.test.ts` — passed: 1 file, 15 tests.
- `npm run check` — failed in `src/account-map/ui/AccountMapCanvas.tsx(97,95)`: Task 2 has not yet updated its caller for the required three-argument `layoutAccountMap(graph, viewport, zoom)` signature.

## Self-review

- Comparator ordering matches the approved Task 1 contract: primary income location; remaining locations by amount/count/normalized name/ID; system purposes; custom purposes by stored parent order/target/name/ID; status nodes.
- Primary-income selection excludes zero-value, archived, missing, and non-active candidates; no-income data remains an ordinary unresolved income purpose.
- The remaining type-check failure is an intentional task boundary handoff to Task 2; no unrelated file was modified to conceal it.

## Final note

- Task 1 is committed separately as requested. Task 2 must update `AccountMapCanvas` to call `layoutAccountMap(graph, viewport, zoom)` before the repository-wide type check can pass.

## Fix-round — review findings

### Findings addressed

- `selectPrimaryIncomeLocationId` now excludes active income links whose `locationId` is absent from the location registry, while retaining the existing archived and zero-value exclusions. Missing, archived, and zero-value candidate regressions all preserve the unanchored ordinary income purpose.
- Desktop geometry now builds an Account Map graph from a non-first primary-income link, proving the graph metadata selects the top-left anchor rather than fixture storage order.
- Amount changes now have a behavior test showing only ordinary location slots reorder; ordinary node dimensions and layout edge data remain unchanged.

### Files changed

- `src/account-map/ui/mapLayout.ts`
- `tests/unit/account-map/mapLayout.test.ts`

### TDD and verification evidence

- RED: `npx vitest run tests/unit/account-map/mapLayout.test.ts` — 19 tests, 1 expected failure after correcting the hand-built graph fixture: `keeps income unanchored for a missing candidate` received `"missing-income"` instead of `null`.
- GREEN: `npx vitest run tests/unit/account-map/mapLayout.test.ts` — passed: 1 file, 19 tests.
- Self-review: inspected the focused diff; the only production change requires a resolved location before amount aggregation and does not alter `AccountMapApplied.layout`, backup/parser behavior, write ownership, or Task 2 callers.
- `npm run check` — failed as already handed off: `src/account-map/ui/AccountMapCanvas.tsx(97,95): error TS2554: Expected 3 arguments, but got 4.` No caller change was made in this Task 1 fix round.
- `git diff --check` — passed.
