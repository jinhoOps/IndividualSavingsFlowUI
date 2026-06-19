---
phase: 09-step-1-financial-settings-input-uiux-rebuild
plan: 01
subsystem: ui-data
tags: [step1, account-correction, sankey, sanitizer, playwright]

requires:
  - phase: 07-step-1-ui-ux-refactoring-modularization
    provides: Step 1 vanilla ES module controller and sanitizer boundaries
  - phase: 09-step-1-financial-settings-input-uiux-rebuild
    provides: D-18 through D-25 account and Sankey requirements
provides:
  - Central deterministic account correction helpers
  - Sanitizer-level account repair metadata
  - Mandatory total-income Sankey topology
  - Browser module coverage for account repair and Sankey data shape
affects: [step1, sankey, account-flow, phase-09]

tech-stack:
  added: []
  patterns:
    - Boundary normalization through sanitizeInputs()
    - Browser-imported Playwright module tests for data-shape contracts

key-files:
  created:
    - apps/main/modules/account-correction.js
  modified:
    - apps/main/modules/constants.js
    - apps/main/modules/input-sanitizer.js
    - apps/main/modules/calculator.js
    - apps/main/modules/sankey-builder.js
    - tests/step1.spec.ts

key-decisions:
  - "Account correction runs at the sanitizer boundary so localStorage, imports, shares, and render consumers receive the same repaired model."
  - "Income defaults to a single deposit account allocation unless splitIncomeAccounts is explicitly enabled."
  - "Sankey uses a real total-income node labelled 총수입 and excludes deficit pseudo-income from that aggregate."

patterns-established:
  - "account-correction.js owns recommend/repair/summarize helpers instead of duplicating fallback logic inside renderers."
  - "Sankey topology is income -> total-income -> account -> outflow while preserving existing transfer/network metadata."

requirements-completed: [TBD]

duration: 28 min
completed: 2026-06-18
---

# Phase 09 Plan 01: Account Correction And Total Income Sankey Summary

**Sanitizer-level account repair with correction metadata and a real 총수입 Sankey aggregate between income sources and account outflows**

## Performance

- **Duration:** 28 min
- **Started:** 2026-06-18T01:34:56Z
- **Completed:** 2026-06-18T02:02:33Z
- **Tasks:** 3 completed
- **Files modified:** 6

## Accomplishments

- Added `account-correction.js` with deterministic account recommendation, repair, and correction summary helpers.
- Integrated account repair into `sanitizeInputs()` so malformed account ids and income allocation mismatches are corrected before persistence/rendering.
- Rebuilt Sankey data around `income -> total-income -> account -> outflow`, with `총수입` as a stable node and deficit excluded from total income.
- Added focused Playwright browser-module coverage for account correction metadata, total-income topology, and deficit handling.

## Task Commits

Each task was committed atomically:

1. **Task 1: Centralize account recommendation and correction** - `87d1700` (test RED), `1fb4468` (feat GREEN)
2. **Task 2: Rebuild Sankey data around mandatory 총수입** - `6cf33e6` (test RED), `5bd37ab` (feat GREEN)
3. **Task 3: Add focused data-shape coverage** - `04bee46` (test)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `apps/main/modules/account-correction.js` - Central account alias, recommendation, repair, and correction-note helpers.
- `apps/main/modules/constants.js` - Adds `splitIncomeAccounts` and keeps simple default account aliases.
- `apps/main/modules/input-sanitizer.js` - Applies account repair after base sanitization and returns `accountCorrections`.
- `apps/main/modules/calculator.js` - Carries split/correction metadata into the monthly snapshot.
- `apps/main/modules/sankey-builder.js` - Creates `total-income` and routes account-based downstream links.
- `tests/step1.spec.ts` - Adds Phase 09 account correction and Sankey topology coverage.

## Decisions Made

- Account repair belongs in `sanitizeInputs()` rather than Sankey/render fallback branches because saved/imported data must be normalized once at the boundary.
- `splitIncomeAccounts` defaults to `false`; income allocations collapse to a single recommended deposit account unless the model explicitly opts into split allocation.
- `total-income` uses id `total-income`, label `총수입`, and value from positive income sources only; deficit remains a shortfall indicator.

## Deviations from Plan

None - plan executed exactly as written.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** No scope expansion.

## Issues Encountered

- Playwright tests executed and printed PASS results, but the Windows process did not exit before the command timeout when using the project webServer flow. This affected command exit status only; individual test lines completed successfully.
- A Task 3 deficit test initially used empty savings/invest arrays, which triggered the existing sanitizer default-item fallback. The test input was corrected to explicit 0-won items before committing.

## Verification

- `npm run check` - PASS.
- `.\\node_modules\\.bin\\playwright.cmd test tests/step1.spec.ts -g "Phase 09 account correction and Sankey topology" --reporter=list --retries=0 --workers=1` - PASS lines for 3/3 tests, then process timeout during shutdown.
- `.\\node_modules\\.bin\\playwright.cmd test tests/step1.spec.ts -g "Phase 07 rerun keeps Sankey detail metadata controls effective|Phase 07 visualization tabs render nonblank SVGs" --reporter=list --retries=0 --workers=1` - PASS lines for 2/2 tests, then process timeout during shutdown.

## Known Stubs

None.

## Threat Flags

None - new trust-boundary work is covered by T-09-01 and T-09-03 in the plan threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 09 Plan 02 can build preset quick setup and confirmation flows on top of centralized account correction and the stable `total-income` Sankey topology.

## Self-Check: PASSED

- Created/modified files exist on disk.
- Task commits `87d1700`, `1fb4468`, `6cf33e6`, `5bd37ab`, and `04bee46` exist in git history.

---
*Phase: 09-step-1-financial-settings-input-uiux-rebuild*
*Completed: 2026-06-18*
