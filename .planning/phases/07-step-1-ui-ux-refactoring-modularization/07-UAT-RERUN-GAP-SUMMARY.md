---
phase: 07-step-1-ui-ux-refactoring-modularization
plan: uat-rerun-gap-closure
status: complete
subsystem: ui
tags: [step1, uat, money-input, sankey, account-flow, mobile]
requires:
  - phase: 07-step-1-ui-ux-refactoring-modularization
    provides: Phase 07 UAT re-run gap diagnosis
provides:
  - Low-noise comma-formatted Won inputs
  - Lower neutral preset starting capital
  - Collapsible allocation group directories
  - Sankey detail mode that honors grouping metadata
  - Larger account-flow network map defaults
  - Reduced nested-control visual noise
affects: [step1, main-ui, sankey, account-flow, uat]
tech-stack:
  added: []
  patterns: [formatted-money-inputs, collapsible-allocation-groups, metadata-driven-visualization]
key-files:
  created:
    - .planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT-RERUN-GAP-SUMMARY.md
  modified:
    - .planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT.md
    - apps/main/index.html
    - apps/main/styles.css
    - apps/main/modules/list-renderer.js
    - apps/main/modules/network-map-renderer.js
    - apps/main/modules/presets.js
    - apps/main/modules/sankey-renderer.js
    - apps/main/modules/state-helpers.js
    - shared/core/utils.js
    - tests/step1.spec.ts
key-decisions:
  - "Won input formatting now lives in text inputs with parse-on-read normalization, because number inputs cannot display thousands separators."
  - "Allocation list directories use the final segment of `item.group` so paths such as `생활비-고정비-공과금` collapse at the useful subcategory level."
  - "Sankey detail mode no longer forces item-level grouping; the existing metadata selects remain the source of truth."
patterns-established:
  - "Use `data-money-input=\"won\"` for comma-formatted KRW text inputs that still serialize to numeric state."
  - "Render dense allocation lists as grouped `details` sections to reduce mobile vertical overflow."
requirements-completed: [UI-01, UI-02]
duration: 45min
completed: 2026-06-16
---

# Phase 07 UAT Re-run Gap Closure Summary

**Step 1 UAT re-run gaps closed across money inputs, neutral reset defaults, collapsible allocation lists, visualization metadata, and dense UI styling.**

## Performance

- **Duration:** 45 min
- **Completed:** 2026-06-16
- **Tasks:** 5
- **Files modified:** 10

## Accomplishments

- Removed always-visible realtime Won helper rows and replaced them with comma-formatted Won text inputs plus unobtrusive title helper text.
- Lowered neutral preset starting capital by one decimal place for cash, savings, and investments while keeping reset in place.
- Added collapsible allocation group directories for long expense/savings/invest item lists.
- Restored metadata-driven Sankey detail behavior and increased account-flow map readability.
- Reduced visual weight of `#visualizationToggle`, dense cards, row borders, and hover outlines.

## Verification

- `node --check shared/core/utils.js` passed.
- `node --check apps/main/modules/list-renderer.js` passed.
- `node --check apps/main/modules/state-helpers.js` passed.
- `node --check apps/main/modules/presets.js` passed.
- `node --check apps/main/modules/sankey-renderer.js` passed.
- `node --check apps/main/modules/network-map-renderer.js` passed.
- `npm run check` passed.
- `npx playwright test tests/step1.spec.ts -g "Phase 07" --reporter=list --timeout=30000` printed all 6 Phase 07 tests as passed; the command process timed out while waiting for Playwright/webServer shutdown.

## Issues Encountered

- Playwright on this Windows setup prints all test passes but does not exit before the shell timeout when the configured webServer is involved. The individual test output is retained as verification evidence.

## Next Phase Readiness

Phase 7 is ready for a fresh `$gsd-verify-work 7` conversational UAT pass, then Phase 8 routing.

## Self-Check: PASSED
