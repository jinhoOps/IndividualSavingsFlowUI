---
phase: 08-step-2-redesign-re-planning
plan: 03
subsystem: ui
tags: [step2, mobile, strategy-comparison, data-hub, playwright]

requires:
  - phase: 08-step-2-redesign-re-planning
    provides: Strategy assumptions and comparison calculator from Plan 02
provides:
  - Mobile-first Step 2 DOM order from judgment to inputs, KPI, chart, cards, and detail
  - Strategy cards, benchmark selection, collapsed advanced assumptions, and visible simulation save action
  - KPI, multi-strategy chart, dense comparison cards, 50M KRW initial-capital warning, and collapsed detail table
  - Safe DataHub simulation list rendering with textContent and dataset for user-controlled names and ids
  - Phase 08 Playwright coverage and 390px/768px screenshots for first-screen and DataHub flows
affects: [phase-08-step2-redesign, step2-ui, data-hub, playwright]

tech-stack:
  added: []
  patterns:
    - DOM-order-first mobile Step 2 layout
    - Strategy comparison UI driven by centralized assumptions and calculateStrategyComparison
    - DataHub simulation rows built with DOM APIs for user-controlled strings

key-files:
  created:
    - .planning/phases/08-step-2-redesign-re-planning/08-03-SUMMARY.md
  modified:
    - apps/simulation/index.html
    - apps/simulation/styles.css
    - apps/simulation/modules/dom.js
    - apps/simulation/modules/renderers.js
    - apps/simulation/modules/ui-controller.js
    - shared/components/data-hub-modal.js
    - tests/step2.spec.ts

key-decisions:
  - "Step 2 first-screen order now follows the mobile judgment flow in actual DOM order instead of CSS-only reordering."
  - "The dashboard renders selected strategy KPIs from calculateStrategyComparison, with benchmark delta shown as a signed Won opportunity-cost signal."
  - "DataHub simulation list names and ids are rendered with textContent and dataset while static modal templates remain unchanged."

patterns-established:
  - "Primary Step 2 inputs stay limited to initial investment, monthly investment, and horizon; assumptions move behind a collapsed details panel."
  - "Playwright Phase 08 tests assert visual order, overflow, chart tooltip, warning, collapsed detail, and visible DataHub CRUD flows."

requirements-completed: [UI-03]

duration: 19 min
completed: 2026-06-17
---

# Phase 08 Plan 03: Step 2 First-Screen Redesign Summary

**Step 2 now opens as a mobile-first strategy choice guide comparing index growth, SCHD, and covered-call cash-flow outcomes with KPI, chart, card, detail, and DataHub regression coverage.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-06-17T08:12:07Z
- **Completed:** 2026-06-17T08:31:19Z
- **Tasks:** 3 completed
- **Files modified:** 7

## Accomplishments

- Reordered the Step 2 first screen in actual DOM order: judgment, primary inputs, KPI, graph, comparison cards, guidance, collapsed detail.
- Replaced the old preset-combination-first UI with strategy cards, Nasdaq/S&P 500 benchmark selection, covered-call example selection, and collapsed editable assumptions.
- Rendered final expected assets, expected monthly cash flow, and signed benchmark delta from the Plan 02 strategy comparison calculator.
- Replaced the old 100M total-operation warning with a 50M KRW-or-less warning based only on `totalInitialAsset`.
- Added multi-strategy SVG chart, dense comparison cards, final accumulation-vs-cash-flow guidance, and horizontally scrollable collapsed yearly detail.
- Refactored DataHub simulation rows to use `textContent` and `dataset` for saved simulation names and ids.
- Added Phase 08 Playwright coverage for desktop/tablet/mobile order, KPI labels, warning behavior, chart/tooltip, overflow, details, screenshots, and DataHub CRUD fallback.

## Task Commits

Each task was committed atomically:

1. **Task 1: First-screen DOM and interaction anchors** - `0fb5bf4` (feat)
2. **Task 2: KPI, graph, comparison cards, warning, and safe list rendering** - `cb55d01` (feat)
3. **Task 3: Phase 08 mobile and first-screen verification gate** - `fa9a41a` (test)

## Files Created/Modified

- `apps/simulation/index.html` - Mobile-first Step 2 anchors, primary inputs, strategy cards, advanced assumptions, save action, KPI/chart/cards/detail order.
- `apps/simulation/modules/dom.js` - DOM registry entries for strategy, benchmark, save, comparison card, guidance, and detail targets.
- `apps/simulation/modules/ui-controller.js` - Strategy card, benchmark, covered-call, advanced assumption, period, and save bindings.
- `apps/simulation/modules/renderers.js` - Comparison-driven KPI, warning, SVG chart, dense cards, final guidance, detail summary, and table rendering.
- `apps/simulation/styles.css` - Responsive editorial Step 2 layout, stable card/chart dimensions, collapsed detail/table scroll, and mobile rules.
- `shared/components/data-hub-modal.js` - Simulation list DOM construction with `textContent`/`dataset`.
- `tests/step2.spec.ts` - Phase 08 first-screen, mobile, warning, chart, tooltip, screenshots, and DataHub tests.

## Decisions Made

- Kept user-visible simulation save as a direct Step 2 button that calls `featureController.saveCurrent()` while preserving the existing DataHub modal flow.
- Used the selected strategy as the KPI perspective, while comparison cards keep all three strategy families visible on the same screen.
- Kept generated chart/table HTML limited to fixed labels and numeric calculator output; user-controlled DataHub strings are DOM-rendered safely.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] Corrected mobile layout jump assertion**
- **Found during:** Task 3 (Phase 08 mobile and first-screen verification gate)
- **Issue:** The first Playwright assertion compared viewport-relative chart `y` before and after clicking a strategy card. Playwright scrolled the clicked card into view, so the assertion reported a false 948px layout jump.
- **Fix:** Changed the assertion to compare document-relative position (`getBoundingClientRect().top + scrollY`) so it measures actual layout movement.
- **Files modified:** `tests/step2.spec.ts`
- **Verification:** Filtered rerun for chart/DataHub tests passed, then full Phase 08 managed-server run passed 10/10.
- **Committed in:** `fa9a41a`

**2. [Rule 1 - Test Bug] Scoped DataHub empty-state assertion to the simulation tab**
- **Found during:** Task 3 (Phase 08 mobile and first-screen verification gate)
- **Issue:** The empty-state assertion matched both the simulation empty message and the backup empty message inside the open Shadow DOM.
- **Fix:** Scoped the locator to `#tab-simulations .empty`.
- **Files modified:** `tests/step2.spec.ts`
- **Verification:** Filtered rerun for chart/DataHub tests passed, then full Phase 08 managed-server run passed 10/10.
- **Committed in:** `fa9a41a`

**3. [Rule 3 - Blocking] Used agent-managed Vite server for final Playwright verification**
- **Found during:** Task 3 and plan-level verification
- **Issue:** The exact command `npx playwright test tests/step2.spec.ts -g "Phase 08" --reporter=list --timeout=30000` printed all 10 passing tests but did not return before the shell timeout while the configured Windows webServer lifecycle waited.
- **Fix:** Re-ran the same filtered test command against a Vite server started and stopped inside the agent command.
- **Files modified:** None
- **Verification:** Managed-server command exited 0 with `10 passed (12.5s)`.
- **Committed in:** Not applicable; verification-only deviation.

**4. [Rule 1 - Documentation Integrity] Restored STATE/ROADMAP shape after SDK progress updates**
- **Found during:** Metadata update
- **Issue:** `state.advance-plan` could not parse the existing `Plan: 03/04` field, and `roadmap.update-plan-progress` rewrote the Phase 8 roadmap table row with shifted columns.
- **Fix:** Updated `STATE.md` to Phase 08 Plan 04 readiness with 12/13 progress and restored the Phase 8 roadmap row's Goal, Requirements, and Success Criteria columns while preserving `In Progress (3/4 plans, 2026-06-17)`.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`
- **Verification:** Diff confirms the five-column roadmap row is restored and STATE reflects Plan 03 completion.
- **Committed in:** Plan metadata commit.

---

**Total deviations:** 4 auto-fixed (2 test bugs, 1 blocking verification issue, 1 documentation integrity issue)
**Impact on plan:** No product scope expansion. The fixes made the requested verification reliable in this Windows environment and did not change the Step 2 feature scope.

## Issues Encountered

- The direct Playwright command showed `10 passed` lines but timed out during webServer shutdown. Final verification used the same Phase 08 filter with an agent-managed Vite server and exited cleanly.
- Plan 08-04 committed data documentation and root CSV cleanup while this plan was running. The 08-03 commits remained limited to this plan's UI/test scope.

## Verification

- `node --check apps/simulation/modules/dom.js` - PASS
- `node --check apps/simulation/modules/ui-controller.js` - PASS
- `node --check apps/simulation/modules/renderers.js` - PASS
- `node --check shared/components/data-hub-modal.js` - PASS
- `node -e "...old 100M warning token scan..."` - PASS
- `npm run check` - PASS
- `npx playwright test tests/step2.spec.ts -g "Phase 08" --reporter=list --timeout=30000` - PASS lines observed for 10/10, then shell timeout during webServer shutdown
- Same Phase 08 Playwright filter with agent-managed Vite server - PASS, 10/10
- Screenshots generated: `test-results/phase08-step2-mobile-768.png`, `test-results/phase08-step2-mobile-390.png`

## Known Stubs

None. Stub scan found only intentional empty defaults/reset values and static input placeholder text; no unresolved UI stubs block the plan goal.

## Threat Flags

None. DataHub simulation list rendering now mitigates the planned user-controlled name/id Shadow DOM injection surface. No new network endpoints, auth paths, file access patterns, or schema trust boundaries were introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 08-03 is complete. Phase 08 can finish once the parallel Plan 08-04 creates its summary and metadata; the Step 2 UI now consumes the Plan 02 comparison model and exposes regression coverage for the redesigned first screen.

## Self-Check: PASSED

- Summary file created at `.planning/phases/08-step-2-redesign-re-planning/08-03-SUMMARY.md`.
- Task commits exist in git: `0fb5bf4`, `cb55d01`, and `fa9a41a`.
- Screenshots exist at `test-results/phase08-step2-mobile-768.png` and `test-results/phase08-step2-mobile-390.png`.
- Modified source/test files match the plan scope; remaining untracked `scripts/__pycache__/` is outside this plan and was not touched.

---
*Phase: 08-step-2-redesign-re-planning*
*Completed: 2026-06-17*
