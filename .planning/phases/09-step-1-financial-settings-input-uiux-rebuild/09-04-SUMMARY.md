---
phase: 09-step-1-financial-settings-input-uiux-rebuild
plan: 04
subsystem: ui
tags: [step1, sankey, account-correction, tooltip, responsive, playwright]

requires:
  - phase: 09-step-1-financial-settings-input-uiux-rebuild
    provides: Account repair boundary, preset setup, financial summary cards, and modal creation flows from Plans 09-01 through 09-03
provides:
  - Manual Sankey account correction refresh control
  - Visible Sankey account correction status text
  - Line-broken merged Sankey tooltip metadata
  - Final Phase 09 responsive Playwright coverage at 1280, 768, and 390 widths
affects: [step1, sankey, account-flow, phase-09]

tech-stack:
  added: []
  patterns:
    - User-triggered repair reuses sanitizeInputs() and account-correction.js rather than adding renderer-local fallback logic
    - Sankey tooltip details remain textContent-based with CSS pre-line wrapping
    - Phase-wide Playwright coverage groups user-flow, Sankey, modal, preset, money, and responsive checks under Phase 09

key-files:
  created: []
  modified:
    - apps/main/index.html
    - apps/main/styles.css
    - apps/main/modules/dom.js
    - apps/main/modules/visualization-controller.js
    - apps/main/modules/render-orchestrator.js
    - apps/main/modules/sankey-renderer.js
    - tests/step1.spec.ts

key-decisions:
  - "Manual Sankey correction refresh runs the same sanitizeInputs()/repairAccountConnections path used by saved, imported, and rendered Step 1 data."
  - "Merged Sankey tooltip metadata stays in textContent and uses newline-separated rows with CSS pre-line wrapping instead of HTML injection."
  - "Final Phase 09 coverage uses Playwright viewport checks at 1280, 768, and 390 widths without adding screenshot artifacts."

patterns-established:
  - "Sankey header controls expose both correction action and correction status without changing PNG export or network-map tab behavior."
  - "Tooltip readability is asserted through actual SVG path mousemove dispatch and text-safe DOM inspection."

requirements-completed: [TBD]

duration: 22 min
completed: 2026-06-18
---

# Phase 09 Plan 04: Sankey Correction Refresh And Tooltip Coverage Summary

**Manual Sankey account correction refresh with visible repair status, readable merged tooltip rows, and Phase 09 responsive Playwright regression coverage**

## Performance

- **Duration:** 22 min
- **Started:** 2026-06-18T03:11:31Z
- **Completed:** 2026-06-18T03:33:46Z
- **Tasks:** 3 completed
- **Files modified:** 7

## Accomplishments

- Added a visible `계좌 보정` Sankey header control and correction status text.
- Wired manual correction refresh through `sanitizeInputs()` so the same account repair path persists and rerenders the repaired state.
- Updated merged Sankey tooltip details from comma-crammed text to one item per line while preserving `textContent` rendering.
- Added final Phase 09 Playwright coverage for summary-first order, correction refresh, basic/detail Sankey labels, tooltip readability, and no horizontal overflow at 1280/768/390.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Sankey correction refresh and stable basic/detail behavior** - `f6ce866` (test RED), `fd7f596` (feat GREEN)
2. **Task 2: Make merged Sankey hover details readable** - `0d4e20c` (test RED), `51a20d5` (feat GREEN)
3. **Task 3: Add Phase 09 Playwright coverage and run final gates** - `3d1b31f` (test)

**Plan metadata:** pending docs commit

## Files Created/Modified

- `apps/main/index.html` - Adds Sankey correction refresh button and status text in the Sankey controls.
- `apps/main/styles.css` - Adds correction control styling and tooltip pre-line wrapping constraints.
- `apps/main/modules/dom.js` - Registers Sankey correction control/status nodes.
- `apps/main/modules/visualization-controller.js` - Runs manual account repair through `sanitizeInputs()` and updates correction feedback.
- `apps/main/modules/render-orchestrator.js` - Keeps correction status synced on render.
- `apps/main/modules/sankey-renderer.js` - Formats merged tooltip details as newline-separated text-safe rows.
- `tests/step1.spec.ts` - Adds Phase 09 correction refresh, tooltip readability, and final responsive user-flow coverage.

## Decisions Made

- Manual correction refresh does not duplicate account heuristics; it calls the existing sanitizer/account repair boundary and then uses the existing persistence/rerender path.
- Tooltip details remain `textContent` so user-controlled names such as `<b>` or `&` render as text, not markup.
- The network-map tab and PNG export path were left unchanged; the new control is scoped to Sankey correction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Synced correction status from render orchestrator**
- **Found during:** Task 1 (Add Sankey correction refresh and stable basic/detail behavior)
- **Issue:** The declared files did not include `render-orchestrator.js`, but correction status needs to reflect sanitizer metadata after normal render, not only after button clicks.
- **Fix:** Added a small render-time status sync that reads `inputs.accountCorrections` and updates the Sankey correction badge/title.
- **Files modified:** `apps/main/modules/render-orchestrator.js`
- **Verification:** `npm run check` passed; Phase 09 correction refresh test printed PASS.
- **Committed in:** `fd7f596`

---

**Total deviations:** 1 auto-fixed (1 missing critical).
**Impact on plan:** The deviation is limited to surfacing required D-22/D-25 feedback consistently; no new product surface or architecture was added.

## Issues Encountered

- Playwright targeted and full Phase 09 runs printed PASS lines for all selected tests but did not exit before the command timeout, matching the shutdown behavior documented in Plans 09-01 through 09-03.
- The first tooltip-readability test used pointer coordinates that did not reliably target SVG paths in headless Chromium; the test was corrected to dispatch `mousemove` on actual path elements while still validating real tooltip DOM output.
- `npm run build` increments project version files as a script side effect. The build passed, and the generated version bump was reverted because it is outside Plan 09-04 scope.

## Verification

- `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09 manual Sankey account correction refresh|Phase 09 basic Sankey starts" --reporter=list --retries=0 --workers=1` - PASS lines for 2/2 tests, then process timeout during shutdown.
- `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09 Sankey tooltip readability" --reporter=list --retries=0 --workers=1` - PASS line, then process timeout during shutdown.
- `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09 final responsive user flow coverage" --reporter=list --retries=0 --workers=1` - PASS line, then process timeout during shutdown.
- `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09" --reporter=list --retries=0 --workers=1` - PASS lines for 14/14 tests, then process timeout during shutdown.
- `npm run check` - PASS.
- `npm run build` - PASS; Vite emitted pre-existing CSS minifier warnings for `calc()` expressions without whitespace.

## Known Stubs

None. Stub scan only found existing input `placeholder` attributes and unrelated existing placeholder-like CSS selector text; no new stubbed UI or mock data path was introduced.

## Threat Flags

None - the new user-triggered correction refresh and tooltip/detail rendering surfaces are covered by T-09-10 and T-09-12 in the plan threat model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 09 is complete. Step 1 now has summary-first financial setup, preset confirmation, modal editing/creation, deterministic account correction, canonical `총수입` Sankey behavior, readable merged metadata, and responsive Playwright coverage.

## Self-Check: PASSED

- Created/modified files exist on disk.
- Task commits `f6ce866`, `fd7f596`, `0d4e20c`, `51a20d5`, and `3d1b31f` exist in git history.
- `npm run check` passed after task commits.
- Full targeted Phase 09 Playwright run printed PASS lines for 14/14 tests.

---
*Phase: 09-step-1-financial-settings-input-uiux-rebuild*
*Completed: 2026-06-18*
