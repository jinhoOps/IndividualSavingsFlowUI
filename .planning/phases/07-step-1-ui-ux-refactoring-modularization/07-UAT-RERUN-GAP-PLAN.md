---
phase: 07-step-1-ui-ux-refactoring-modularization
plan: uat-rerun-gap-closure
type: execute
gap_closure: true
source: 07-UAT.md
status: complete
created: 2026-06-16T16:30:49.8121375+09:00
requirements_addressed:
  - UI-01
  - UI-02
---

# Phase 07 UAT Re-run Gap Closure Plan

## Objective

Close the five diagnosed gaps found during the Phase 07 UAT re-run while preserving the completed modularization, layout order, and previous gap-closure behavior.

## Tasks

### 1. Reduce money-input helper noise and add formatted Won entry

Files:
- `shared/core/utils.js`
- `apps/main/index.html`
- `apps/main/modules/state-helpers.js`
- `apps/main/modules/ui-controller.js`
- `apps/main/modules/list-renderer.js`
- `tests/step1.spec.ts`

Actions:
- Stop inserting always-visible `.realtime-won-hint` elements into dense number rows, or limit them to an unobtrusive on-focus/helper surface.
- Add a working `startCash` helper that explains initial cash without changing row height.
- Support comma-formatted Won input display for money fields while preserving normalized numeric state.
- Keep parsing robust for imported/restored data and edited item rows.

Verification:
- Enter large Won values and confirm the visible input uses `,` every three digits.
- Confirm dense grids do not gain extra rows from realtime conversion text.
- Confirm `startCash` helper is visible/usable.

### 2. Lower neutral reset starting-capital defaults

Files:
- `apps/main/modules/presets.js`
- `apps/main/modules/bootstrap-controller.js`
- `tests/step1.spec.ts`

Actions:
- Keep reset using the neutral annual-income `50,000,000` KRW preset.
- Reduce neutral starting capital by one decimal place from the current generated values, or introduce a reset-specific neutral seed profile with smaller initial cash/savings/invest values.
- Keep existing aggressive/beast behavior unless product direction explicitly changes it.

Verification:
- Reset initializes in place and does not navigate.
- Reset values reflect the smaller capital baseline.

### 3. Add collapsible group directories for long item lists

Files:
- `apps/main/modules/list-renderer.js`
- `apps/main/modules/bootstrap-controller.js`
- `apps/main/styles.css`
- `tests/step1.spec.ts`

Actions:
- Group expense, savings, and invest lists by `item.group`.
- Render each group as a collapsible directory-like section in view and edit modes.
- Preserve item editing, delete, group rename, sort, and total-hint behavior.
- Persist open/closed state during the current editing session.

Verification:
- Create many 생활비 items and confirm the group can be collapsed to reduce vertical overflow.
- Confirm item edits still update totals and apply correctly.

### 4. Rework visualization detail semantics and account-flow readability

Files:
- `apps/main/modules/sankey-renderer.js`
- `apps/main/modules/bootstrap-controller.js`
- `apps/main/modules/network-map-renderer.js`
- `apps/main/styles.css`
- `apps/main/index.html`
- `tests/step1.spec.ts`

Actions:
- Keep the basic Sankey view integrated by default.
- In detail mode, make metadata/grouping controls effective instead of forcing every category to `detail`.
- Consider surfacing grouping metadata editing from detail mode if the current controls are insufficient.
- Increase account-flow map readability through larger default scale, zoom controls, expanded panel mode, or a better responsive layout.

Verification:
- Detail mode honors grouping select metadata.
- Basic mode remains integrated.
- 계좌 흐름도 is readable at desktop and mobile widths.

### 5. Minimal visual-noise pass for nested controls

Files:
- `apps/main/styles.css`
- `apps/main/index.html`
- `tests/step1.spec.ts`

Actions:
- Reduce visual weight of `#visualizationToggle` and similar nested segmented controls.
- Remove excessive borders/backgrounds inside already-framed cards and panels.
- Preserve focus states and accessibility while lowering inactive outlines.
- Normalize hover styling so dense rows do not all compete for attention.

Verification:
- Screenshot review of Step 1 header, visualization controls, and dense management cards.
- Keyboard focus remains visible.
- No horizontal overflow regressions on mobile.

## Required Checks

- `npm run check`
- `node --check apps/main/modules/bootstrap-controller.js`
- `node --check apps/main/modules/sankey-renderer.js`
- `node --check apps/main/modules/network-map-renderer.js`
- `npx playwright test tests/step1.spec.ts -g "Phase 07" --reporter=list --timeout=30000`
- Re-run `$gsd-verify-work 7` after fixes
