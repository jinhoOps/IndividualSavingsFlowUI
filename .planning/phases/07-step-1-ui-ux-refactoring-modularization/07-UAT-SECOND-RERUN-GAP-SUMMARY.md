---
phase: 07-step-1-ui-ux-refactoring-modularization
plan: uat-second-rerun-gap-closure
subsystem: ui
tags: [step1, uat, money-input, account-flow, sankey, visual-polish]
requires:
  - phase: 07-step-1-ui-ux-refactoring-modularization
    provides: Second UAT re-run diagnosed gaps
provides:
  - Correct account-flow Won unit rendering
  - Consistent comma-formatted Won input handling
  - Normalized default expense/savings/investment taxonomy
  - Detail-only Sankey grouping metadata controls
  - Reduced dense input-card visual noise
affects: [step1, main-ui, account-flow, sankey, tests]
tech-stack:
  added: []
  patterns: [capture-phase-money-input-commit, detail-scoped-controls, pwa-safe-playwright]
key-files:
  created:
    - .planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT-SECOND-RERUN-GAP-SUMMARY.md
  modified:
    - .planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT.md
    - .planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT-SECOND-RERUN-GAP-PLAN.md
    - apps/main/index.html
    - apps/main/styles.css
    - apps/main/modules/bootstrap-controller.js
    - apps/main/modules/constants.js
    - apps/main/modules/list-renderer.js
    - apps/main/modules/network-map-renderer.js
    - apps/main/modules/presets.js
    - apps/main/modules/state-helpers.js
    - apps/main/modules/ui-controller.js
    - playwright.config.ts
    - shared/core/utils.js
    - src/core/storage/CompatibilityBridge.ts
    - tests/step1.spec.ts
key-decisions:
  - "Removed the extra network-map 10,000x multiplier because account-flow data already arrives in Won units."
  - "Committed form money input changes at capture phase and debounced full rerender to avoid active-field reverts."
  - "Preserved modern `IsfUtils` helpers in `CompatibilityBridge` instead of overwriting them with legacy ManWon helpers."
requirements-completed: [UI-01, UI-02]
duration: 55min
completed: 2026-06-16
---

# Phase 07 UAT Second Re-run Gap Closure Summary

**Second UAT re-run gaps were closed for account-flow units, Won input persistence, default grouping taxonomy, detail-only Sankey controls, and dense UI polish.**

## Accomplishments

- Fixed account-flow labels by formatting network node and transfer values directly in Won units.
- Fixed comma-formatted money input persistence, including values above 5,000,000 for initial cash and investment balances.
- Prevented `CompatibilityBridge` from overwriting modern `IsfUtils.toWon`, `toMan`, and `formatMoney` with legacy helpers.
- Normalized default expense groups around 생활비/고정비 and 자유소비 examples, while savings and investment default to 저축 and 투자 groups.
- Hid Sankey grouping metadata controls outside detail mode.
- Reduced dense nested input-card and toggle border weight.
- Blocked service workers during Playwright runs so regression tests read current dev-server files.

## Verification

- `node --check shared/core/utils.js` passed.
- `node --check apps/main/modules/bootstrap-controller.js` passed.
- `node --check apps/main/modules/list-renderer.js` passed.
- `node --check apps/main/modules/network-map-renderer.js` passed.
- `node --check apps/main/modules/ui-controller.js` passed.
- `node --check apps/main/modules/state-helpers.js` passed.
- `npm run check` passed.
- `npx playwright test tests/step1.spec.ts -g "Phase 07" --reporter=list --timeout=30000` printed all 6 Phase 07 tests as passed; the command process timed out while waiting for Playwright/webServer shutdown.

## Issues Encountered

- The money-input bug was partly caused by `CompatibilityBridge` overwriting modern Won parsers with legacy ManWon aliases. The bridge now preserves existing modern helpers.
- Playwright still times out waiting for the dev-server process to exit after test completion; individual test assertions pass.

## Next Phase Readiness

Ready for another `$gsd-verify-work 7` conversational pass focused on the five resolved second-rerun gaps.

## Self-Check: PASSED
