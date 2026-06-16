---
phase: 07-step-1-ui-ux-refactoring-modularization
plan: gap-closure
type: execute
source: 07-UAT.md
status: ready
created: 2026-06-16T15:17:36.1279925+09:00
requirements_addressed:
  - UI-01
  - UI-02
---

# Phase 07 Gap Closure Plan

## Objective

Close the five diagnosed UAT gaps from `07-UAT.md` without reopening the completed Phase 07 modularization and CSS reduction work.

## Tasks

### 1. Normalize sample, preset, and reset behavior

Files:
- `apps/main/modules/bootstrap-controller.js`
- `apps/main/index.html`
- `tests/step1.spec.ts`

Actions:
- Remove the separate routing-based sample-data action, or make it call the same in-place initialization path as reset.
- Change reset/initialization to apply the neutral preset for annual income `50000000`.
- Keep JSON import, ISF CODE restore, backup restore, and hash restore as in-place normalized commits.
- Ensure preset application completes without unexpected navigation and gives clear feedback.

Verification:
- Add or update Playwright coverage for reset producing neutral 50,000,000 KRW preset data.
- Verify sample button is removed or behaves identically to reset.

### 2. Make Sankey detail mode actually expand fixed-expense children

Files:
- `apps/main/modules/sankey-renderer.js`
- `apps/main/modules/sankey-builder.js`
- `apps/main/modules/bootstrap-controller.js`
- `tests/step1.spec.ts`

Actions:
- When `state.sankeyDetailMode === "detail"`, force expense rendering to item-level detail or override total grouping for fixed expenses.
- Preserve existing grouping selects for basic mode.
- Ensure detail mode visibly differs from basic mode when fixed-expense subitems exist.

Verification:
- Add a Playwright assertion that detail mode renders more fixed-expense nodes/labels than basic mode for seeded data.

### 3. Simplify account management and move rates/other fully into settings

Files:
- `apps/main/index.html`
- `apps/main/styles.css`
- `apps/main/modules/bootstrap-controller.js`
- `tests/step1.spec.ts`

Actions:
- Remove `수익률/기타` from the 지출·저축·투자 advanced tab list.
- Keep growth/yield/return/debt-interest controls in the Settings tab only.
- Simplify account management copy/layout so account creation, account editing, and transfer rules are easier to distinguish.

Verification:
- Add a DOM assertion that `advancedTabRates` is absent from the flow tab and the rates block is reachable under Settings.
- Manually review account-management density on desktop and mobile.

### 4. Fix controls-block unit suffix containment and compact mobile rows

Files:
- `apps/main/styles.css`
- `tests/step1.spec.ts`

Actions:
- Replace fragile fixed-position suffix behavior inside `.controls-block` with a contained input/suffix layout.
- On compact widths, use one-line label/input rows where labels are short enough.
- Keep longer labels wrapping cleanly without overlapping inputs or suffixes.

Verification:
- Add a mobile viewport check for `.controls-block` horizontal overflow and suffix containment.
- Re-run the Phase 07 mobile screenshots at 768px and 390px.

## Required Checks

- `npm run check`
- `npx playwright test tests/step1.spec.ts -g "Phase 07" --reporter=list --timeout=30000`
- Manual UAT re-run for Phase 07 gaps only.
