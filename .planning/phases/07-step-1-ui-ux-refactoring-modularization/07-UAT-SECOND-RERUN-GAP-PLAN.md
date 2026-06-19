---
phase: 07-step-1-ui-ux-refactoring-modularization
plan: uat-second-rerun-gap-closure
type: execute
gap_closure: true
source: 07-UAT.md
status: complete
created: 2026-06-16T17:58:00+09:00
requirements_addressed:
  - UI-01
  - UI-02
---

# Phase 07 UAT Second Re-run Gap Closure Plan

## Objective

Close the five issues found during the second Phase 07 conversational UAT pass, focused on money unit correctness, consistent Won input behavior, expense taxonomy, detail-only metadata controls, and remaining visual noise.

## Tasks

### 1. Fix account-flow map money unit display

Files:
- `apps/main/modules/network-map-renderer.js`
- `tests/step1.spec.ts`

Actions:
- Remove the extra `* 10000` conversion from network transfer labels.
- Remove the extra `* 10000` conversion from account node balances.
- Keep Sankey and summary formatting unchanged.
- Add a regression assertion that the account-flow map does not display 5,000,000 Won as an 억-level value.

Verification:
- 계좌흐름도에서 5,000,000 Won is displayed as roughly `500만 원`, not `500억 원`.
- Existing Phase 07 visualization tests still pass.

### 2. Make Won input formatting consistent and prevent active-field reverts

Files:
- `shared/core/utils.js`
- `apps/main/modules/state-helpers.js`
- `apps/main/modules/bootstrap-controller.js`
- `apps/main/modules/list-renderer.js`
- `apps/main/index.html`
- `tests/step1.spec.ts`

Actions:
- Audit every user-editable Won input and ensure it has `data-money-input="won"` and text/inputmode semantics where comma display is expected.
- Keep one shared parse/format path for settings, item editors, income allocations, modal/preset fields if applicable, and transfer money fields if they are editable Won values.
- Prevent `renderAll()` / `applyInputsToForm()` from rewriting the currently active Won input while the user is typing.
- Preserve numeric state serialization and imported/restored data normalization.

Verification:
- Enter values above `5,000,000` into `startCash` and `startInvest`; values remain editable and persist after blur/render.
- Enter money values in non-settings item editors; visible values use comma grouping.
- `npm run check` and Phase 07 Playwright money-input coverage pass.

### 3. Normalize default expense, savings, and investment grouping taxonomy

Files:
- `apps/main/modules/constants.js`
- `apps/main/modules/presets.js`
- `apps/main/modules/list-renderer.js`
- `tests/step1.spec.ts`

Actions:
- Treat expense as the true free-entry area with clearer default taxonomy.
- Use `생활비-고정비-공과금`, `생활비-고정비-통신비`, `생활비-고정비-교통비`, and `생활비-고정비-식비` for fixed/living expense examples.
- Replace miscellaneous default expense examples with user-free consumption examples such as `자유소비-여행` and `자유소비-취미`.
- Treat savings as `저축` and investment as `투자` grouping at the directory level unless the user edits groups later.
- Keep item editing, delete, add, and group rename behavior intact.

Verification:
- Default expense groups show useful directories such as 공과금, 통신비, 교통비, 식비, 여행, 취미.
- Savings and investment lists do not create confusing subdirectory names by default.
- Collapsing and expanding still reduces vertical height.

### 4. Show Sankey grouping metadata controls only in detail mode

Files:
- `apps/main/index.html`
- `apps/main/modules/bootstrap-controller.js`
- `apps/main/modules/ui-controller.js`
- `apps/main/styles.css`
- `tests/step1.spec.ts`

Actions:
- Hide `.sankey-grouping-controls` in basic Sankey mode and account-flow network mode.
- Show grouping controls when detail Sankey mode is active.
- Preserve current select values when controls are hidden and shown again.
- Keep keyboard and screen-reader access sensible via `hidden`/ARIA state rather than visual-only hiding.

Verification:
- Basic mode starts integrated and does not show grouping selects.
- Detail mode shows grouping selects and honors changes.
- Network mode hides Sankey grouping controls.

### 5. Finish the minimal visual-noise pass for dense input cards

Files:
- `apps/main/styles.css`
- `apps/main/index.html`
- `tests/step1.spec.ts`

Actions:
- Further reduce the visual weight of `#visualizationToggle` so it reads as a header mode control, not a separate card.
- Simplify input-related cards and editing rows by replacing heavy borders/backgrounds with light separators where hierarchy is already clear.
- Remove redundant nested outlines in `.advanced-block`, `.controls-block`, item editor rows, and multi-allocation income rows.
- Preserve visible keyboard focus states.

Verification:
- Dense settings and item editor areas look compact without stacked card borders.
- Toggle controls are less visually isolated from the rest of the UI.
- Mobile containment and Phase 07 layout tests still pass.

## Required Checks

- `node --check shared/core/utils.js`
- `node --check apps/main/modules/bootstrap-controller.js`
- `node --check apps/main/modules/list-renderer.js`
- `node --check apps/main/modules/network-map-renderer.js`
- `npm run check`
- `npx playwright test tests/step1.spec.ts -g "Phase 07" --reporter=list --timeout=30000`
- Re-run `$gsd-verify-work 7` after fixes

## Plan Verification

- The plan maps one task to each diagnosed UAT gap.
- The first task targets the highest-confidence functional bug with minimal blast radius.
- The input-formatting task explicitly covers the reported 5,000,000 Won active-field revert behavior.
- The remaining UI taxonomy and visual changes are scoped to Phase 07 Step 1 surfaces.
