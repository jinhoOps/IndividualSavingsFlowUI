---
phase: 07-step-1-ui-ux-refactoring-modularization
plan: gap-closure
subsystem: ui
tags: [step1, uat, reset, sankey, mobile, account-ux]
requires:
  - phase: 07-step-1-ui-ux-refactoring-modularization
    provides: Diagnosed UAT gaps from 07-UAT.md
provides:
  - Resolved Phase 07 UAT gap statuses
  - In-place neutral 50,000,000 KRW reset behavior
  - Sankey detail-mode item expansion
  - Settings-only rates controls
  - Mobile controls-block containment regression coverage
affects: [step1, main-ui, sankey, mobile-regression]
tech-stack:
  added: []
  patterns: [in-place-reset, detail-mode-grouping-override, compact-mobile-controls]
key-files:
  created:
    - .planning/phases/07-step-1-ui-ux-refactoring-modularization/07-GAP-CLOSURE-SUMMARY.md
  modified:
    - .planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT.md
    - .planning/phases/07-step-1-ui-ux-refactoring-modularization/07-GAP-CLOSURE-PLAN.md
    - apps/main/index.html
    - apps/main/styles.css
    - apps/main/modules/bootstrap-controller.js
    - apps/main/modules/dom.js
    - apps/main/modules/sankey-renderer.js
    - apps/main/modules/ui-controller.js
    - tests/step1.spec.ts
key-decisions:
  - "Removed the separate sample-data button instead of preserving a second path, because the requested behavior was to merge sample loading into reset/initialization."
  - "Made Sankey top-level detail mode override category grouping to individual detail for expense, savings, and investment while leaving grouping selects effective in basic mode."
  - "Kept rates controls in the Settings panel and removed the stale `수익률/기타` tab from the flow tab list."
requirements-completed: [UI-01, UI-02]
duration: 35min
completed: 2026-06-16
---

# Phase 07 Gap Closure Summary

Phase 07 UAT gaps were closed with focused Step 1 fixes and regression coverage.

## Changes

- Removed the routing-based `샘플 불러오기` action and changed reset to apply the neutral annual-income `50,000,000` KRW preset in place.
- Updated reset copy and feedback to describe the neutral 5,000만 원 initialization behavior.
- Changed Sankey detail mode so it renders expense, savings, and investment categories at item-detail level instead of repeating the basic aggregated view.
- Removed the stale `수익률/기타` tab from the 지출·저축·투자 advanced tab list; rates remain under Settings.
- Added short account-management guidance text to separate account naming from transfer-rule setup.
- Tightened mobile `.controls-block .control` layout so compact rows keep labels, inputs, and unit suffixes contained.
- Added Playwright checks for reset behavior, absence of sample/rates stale controls, Sankey detail expansion, and visible mobile controls containment.

## Verification

- `npm run check` passed.
- `node --check apps/main/modules/bootstrap-controller.js` passed.
- `node --check apps/main/modules/sankey-renderer.js` passed.
- `node --check apps/main/modules/dom.js` passed.
- `npx playwright test tests/step1.spec.ts -g "Phase 07" --reporter=list --timeout=30000` printed all 5 Phase 07 tests as passed, then the shell command timed out waiting for process exit. This matches the pre-existing Phase 07 Playwright process-exit caveat.

## UAT Closure

All five gaps in `07-UAT.md` were updated from `failed` to `resolved`.

## Deviations from Plan

The account-management UX was improved with clearer guidance and menu cleanup, not a full account-management redesign. That keeps this gap closure bounded to the UAT findings and avoids reopening a broad Step 1 UI restructuring.

## Next Phase Readiness

Ready for Phase 07 UAT re-run on the resolved gaps, then Phase 8 planning/execution.

## Self-Check: PASSED
