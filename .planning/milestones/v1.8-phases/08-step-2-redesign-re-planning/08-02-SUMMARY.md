---
phase: 08-step-2-redesign-re-planning
plan: 02
subsystem: simulation
tags: [step2, strategy-comparison, assumptions, playwright, dividend]

requires:
  - phase: 08-step-2-redesign-re-planning
    provides: Step 2 storage/import contract from Plan 01
provides:
  - Conservative strategy assumptions for index/growth, SCHD dividend growth, and covered-call/monthly-income examples
  - Pure strategy comparison calculator with Won final asset paths, after-tax monthly cash-flow values, and benchmark deltas
  - Phase 08 Playwright regression coverage for strategy assumptions and comparison output contracts
affects: [phase-08-step2-redesign, step2-calculator, strategy-cards]

tech-stack:
  added: []
  patterns:
    - Strategy assumptions as data shared by UI and calculator
    - Pure comparison calculator separate from legacy dividend projection compatibility wrapper
    - Playwright module-contract tests for deterministic browser-side ES module imports

key-files:
  created:
    - apps/simulation/modules/assumptions.js
    - apps/simulation/modules/comparison-calculator.js
  modified:
    - apps/simulation/modules/state.js
    - apps/simulation/modules/calculator.js
    - apps/simulation/modules/storage-fallback.js
    - tests/step2.spec.ts

key-decisions:
  - "Strategy assumptions are centralized in assumptions.js so UI cards and advanced settings consume the same conservative defaults and display ranges."
  - "calculateDividendProjection remains available, while calculateStrategyComparison is exported from calculator.js for new Step 2 comparison consumers."
  - "Benchmark delta preserves signed Won values so covered-call underperformance versus the selected benchmark remains visible."

patterns-established:
  - "Assumption display ranges stay separate from editable numeric defaults."
  - "Comparison rows expose finalAssets, monthlyCashFlowAfterTax, and benchmarkDelta maps keyed by index, schd, and coveredCall."

requirements-completed: [UI-03]

duration: 17 min
completed: 2026-06-17
---

# Phase 08 Plan 02: Strategy Comparison Model Summary

**Step 2 now has conservative strategy assumptions and a deterministic index/SCHD/covered-call comparison calculator for total asset and monthly cash-flow tradeoffs.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-06-17T07:51:00Z
- **Completed:** 2026-06-17T08:07:39Z
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments

- Added `assumptions.js` with index/growth, dividend growth, and covered-call/monthly-income groups, Nasdaq/S&P 500 benchmarks, SCHD, and JEPI/QQQI/DIVO examples.
- Added exact covered-call defaults and display ranges from the plan: JEPI 6-9% / 0-1% / 0-3%, QQQI 7-11% / 0-1% / 0-4%, and DIVO 3.5-6% / 0-2% / 1-5%.
- Added `calculateStrategyComparison()` with yearly rows containing principal, final asset paths, after-tax monthly cash flow, signed benchmark delta, and numeric percent assumptions.
- Preserved `calculateDividendProjection()` compatibility and re-exported the new comparison calculator from `calculator.js`.
- Extended `tests/step2.spec.ts` with Phase 08 strategy coverage for assumptions, examples, display ranges, editable defaults, and comparison output shape.

## Task Commits

Each task was committed atomically:

1. **Task 1: Strategy assumptions and comparison contract** - `71a714d` (feat)
2. **Task 2: Strategy comparison regression coverage** - `685b1a4` (test)

## Files Created/Modified

- `apps/simulation/modules/assumptions.js` - Strategy group metadata, benchmark options, conservative defaults, display ranges, source evidence keys, and ETF example labels.
- `apps/simulation/modules/comparison-calculator.js` - Pure comparison calculator for index/SCHD/covered-call asset paths, monthly cash flow, and benchmark deltas.
- `apps/simulation/modules/state.js` - Default Step 2 draft strategy selection fields.
- `apps/simulation/modules/calculator.js` - Compatibility export surface for `calculateStrategyComparison()` while keeping `calculateDividendProjection()`.
- `apps/simulation/modules/storage-fallback.js` - Default normalized saved entries to Nasdaq and JEPI when prior entries lack strategy metadata.
- `tests/step2.spec.ts` - Phase 08 strategy contract and calculator regression coverage.

## Decisions Made

- Kept market assumptions static and conservative, with evidence keys pointing to project data context rather than live market requests.
- Used signed Won deltas for benchmark comparisons because underperformance must remain visible for choice guidance.
- Treated UI-facing display ranges as immutable metadata and calculation defaults as editable numeric assumptions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved negative benchmark deltas**
- **Found during:** Task 1 verification
- **Issue:** The first implementation reused positive money sanitization for benchmark deltas, turning covered-call underperformance into `0`.
- **Fix:** Added signed Won rounding for deltas while keeping asset and cash-flow values non-negative Won integers.
- **Files modified:** `apps/simulation/modules/comparison-calculator.js`
- **Verification:** Node sample returned `coveredCall: -78226492` for QQQI versus S&P 500, and Playwright strategy tests passed.
- **Committed in:** `71a714d`

**2. [Rule 3 - Blocking] Used agent-managed Vite server for Playwright verification**
- **Found during:** Task 2 verification
- **Issue:** The exact Playwright command showed all three tests passing but timed out while the Windows webServer lifecycle waited for shutdown.
- **Fix:** Re-ran the same filtered Playwright test with a Vite server started and stopped inside the agent command.
- **Files modified:** None
- **Verification:** Managed-server command exited 0 with `3 passed (4.7s)`.
- **Committed in:** Not applicable; verification-only deviation.

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking verification issue)
**Impact on plan:** No scope expansion. The bug fix was required for the comparison contract, and the verification workaround only addressed the local Windows Playwright server lifecycle.

## Issues Encountered

- `npx playwright test tests/step2.spec.ts -g "Phase 08 strategy" --reporter=list --timeout=30000` timed out after printing all three passing tests. The final verification used the same filter with an agent-managed Vite process and exited 0.

## Verification

- `node --check apps/simulation/modules/assumptions.js` - PASS
- `node --check apps/simulation/modules/comparison-calculator.js` - PASS
- `node --check apps/simulation/modules/calculator.js` - PASS
- `npm run check` - PASS
- `npx playwright test tests/step2.spec.ts -g "Phase 08 strategy" --reporter=list --timeout=30000` - PASS lines observed, then timed out during webServer shutdown
- Same Playwright filter with agent-managed Vite server - PASS, 3/3
- External request scan for new files - PASS, no `fetch`, `XMLHttpRequest`, `WebSocket`, or `EventSource` introduced

## Known Stubs

None. Stub scan found no `TODO`, `FIXME`, `placeholder`, `coming soon`, or `not available` markers in created/modified plan files.

## Threat Flags

None. The changed files introduce no new network endpoints, auth paths, file access patterns, or schema trust boundaries beyond the planned editable-assumption calculator boundary.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 08 Plan 03 can consume the centralized assumptions and comparison output to build the Step 2 editorial cards, KPI set, and graph without duplicating strategy constants.

## Self-Check: PASSED

- Created files exist: `apps/simulation/modules/assumptions.js`, `apps/simulation/modules/comparison-calculator.js`, and this summary.
- Task commits exist in git: `71a714d` and `685b1a4`.

---
*Phase: 08-step-2-redesign-re-planning*
*Completed: 2026-06-17*
