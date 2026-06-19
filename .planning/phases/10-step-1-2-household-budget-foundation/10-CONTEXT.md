# Phase 10: Step 1.2 Household Budget Foundation - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds the Step 1.2 household budget foundation inside `apps/main`. It introduces a compact newlywed household budget surface, optional spouse income context, and target-vs-actual tracking for variable expenses while preserving the existing Step 1 summary-first screen, modal editing, explicit save behavior, persistence path, and Sankey rendering.

This phase should not implement pasted bank/card transaction parsing, dual-ISF household merge, historical spending comparison, real-estate affordability planning, live banking integration, or a separate account-management surface. Those belong to later v1.9 phases or remain out of scope.

</domain>

<decisions>
## Implementation Decisions

### Step 1.2 Entry And Surface
- **D-01:** Step 1.2 uses a hybrid structure: a compact `신혼부부 예산` summary panel on the Step 1 default screen, with detailed input and editing in a modal.
- **D-02:** The summary panel should follow the existing Step 1 direction from Phase 09: summary-first default screen, detail work inside modal flows, and explicit save/cancel behavior.
- **D-03:** The summary panel should not become a full second editor on the default screen. It is a status and entry surface, not the full working area.

### Newlywed Household Context
- **D-04:** The household model is designed around newlywed couples by default.
- **D-05:** Spouse income is optional. The UI and calculations must work when only one partner has income or only one income value is entered.
- **D-06:** Phase 10 should support one-income and dual-income cases without implying that both partners must earn income.

### Summary Panel Density
- **D-07:** The default Step 1.2 summary panel shows three compact metrics: household monthly income, current variable expense actual-vs-target, and remaining variable budget.
- **D-08:** The summary panel includes a short status badge such as `여유`, `주의`, or `초과` so users can judge the household budget state without opening the modal.
- **D-09:** Category-level budget rows and detailed item editing belong inside the modal, not the default summary panel.

### Variable Expense Budget Tracking
- **D-10:** Only variable expense items receive target-vs-actual budget tracking in Phase 10.
- **D-11:** Fixed expenses remain existing planned expense values and should not gain actual-spending controls in this phase.
- **D-12:** The budget model should let variable expenses represent target budget, actual spending, remaining amount, and overspend state.
- **D-13:** Phase 11 pasted transaction capture should be able to feed into the same actual-spending field introduced here.

### End-Of-Month Projection
- **D-14:** End-of-month spending projection uses a simple month-progress method in Phase 10: current actual spending is scaled by elapsed days in the current month.
- **D-15:** The projection should be presented as a lightweight planning estimate, not a precise forecast.
- **D-16:** More advanced transaction-history-based forecasting is deferred until after Phase 11 adds parsed spending events.

### the agent's Discretion
- The planner may choose exact field names for the added data shape, provided existing saved Step 1 data sanitizes safely and legacy records continue to load.
- The planner may choose the exact threshold rules for `여유`, `주의`, and `초과`, provided they are deterministic, compact, and easy to test.
- The planner may choose the exact modal layout and CSS class names as long as it reuses existing Step 1 modal/card patterns and keeps mobile density controlled.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap And Project State
- `.planning/ROADMAP.md` — Phase 10 goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` — HH-01, HH-02, BUD-01, BUD-02, BUD-03, and BUD-04.
- `.planning/PROJECT.md` — v1.9 milestone direction and issue/TODO scope.
- `.planning/STATE.md` — Current workflow position and prior Step 1 decisions.

### Prior Phase Context
- `.planning/milestones/v1.8-phases/09-step-1-financial-settings-input-uiux-rebuild/09-CONTEXT.md` — Summary-first Step 1, modal detail editing, preset setup, account correction, and Sankey stability decisions that Phase 10 must preserve.
- `.planning/milestones/v1.8-phases/07-step-1-ui-ux-refactoring-modularization/07-CONTEXT.md` — Step 1 vanilla ES module, rendering safety, mobile stability, and DESIGN.md constraints.
- `.planning/milestones/v1.8-phases/08-step-2-redesign-re-planning/08-CONTEXT.md` — Relevant local-first and planning-estimate wording patterns for financial projections.

### Codebase Maps
- `.planning/codebase/CONVENTIONS.md` — Three-tier module structure, Won-unit consistency, Step 1 correction/sanitizer boundaries, and summary/modal ownership rules.
- `.planning/codebase/STRUCTURE.md` — `apps/main`, `shared`, and `src` extension guidance.
- `.planning/codebase/STACK.md` — Vite, vanilla ES module, local-first, Playwright, and static-hosting constraints.

### Step 1 Source
- `apps/main/index.html` — Step 1 DOM surface and placement for the summary panel/modal entry.
- `apps/main/app.js` — Main Step 1 orchestration entry.
- `apps/main/styles.css` — Step 1 layout and responsive styling surface.
- `apps/main/modules/dom.js` — DOM registry for new summary panel and modal nodes.
- `apps/main/modules/state.js` — Step 1 state ownership boundary.
- `apps/main/modules/state-helpers.js` — State mutation and derived-value patterns.
- `apps/main/modules/input-sanitizer.js` — Required boundary for backward-compatible household and budget field sanitization.
- `apps/main/modules/persistence-controller.js` — `commitImmediateInputs()` save boundary and persistence flow.
- `apps/main/modules/financial-summary.js` — Existing summary group and card view-model logic.
- `apps/main/modules/financial-summary-renderer.js` — Existing Step 1 summary card rendering pattern.
- `apps/main/modules/financial-modal-controller.js` — Existing modal draft/edit/save pattern to reuse for Step 1.2 detail editing.
- `apps/main/modules/ui-controller.js` — UI synchronization and status patterns.
- `apps/main/modules/list-renderer.js` — Existing item display, account badge, and financial list conventions.
- `apps/main/modules/sankey-builder.js` — Must continue consuming sanitized Step 1 data without corruption.

### Tests
- `tests/step1.spec.ts` — Existing Step 1 regression coverage for summary cards, Sankey, account repair, render safety, and mobile behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/main/modules/financial-summary.js`: Natural place to extend summary view models with a compact household budget group or card.
- `apps/main/modules/financial-summary-renderer.js`: Existing renderer for summary groups/cards; reuse instead of creating a separate visual system.
- `apps/main/modules/financial-modal-controller.js`: Existing modal draft editing, compact row, create flow, and explicit save behavior match the Step 1.2 detail modal.
- `apps/main/modules/input-sanitizer.js`: Existing sanitizer should own budget/actual field defaults and backward-compatible migration for old Step 1 records.
- `apps/main/modules/persistence-controller.js`: `commitImmediateInputs()` already sanitizes, clears draft state, refreshes UI, persists, and re-renders.
- `shared/core/utils.js`: Existing Won formatting and Korean money conversion helpers should be reused for target, actual, remaining, and projection display.

### Established Patterns
- Step 1 uses vanilla ES modules under `apps/main/modules`, not a broad React rewrite.
- Step 1 state changes should flow through sanitized data and explicit persistence boundaries.
- Internal financial values remain in Won; display formatting is a UI concern.
- Default-screen information should stay compact and operational, with detailed editing in modal flows.
- Mobile density is a hard constraint; Phase 10 should avoid large always-open tables on the default screen.

### Integration Points
- Add summary entry markup in `apps/main/index.html` and register it through `apps/main/modules/dom.js`.
- Extend data shape at `apps/main/modules/input-sanitizer.js`, preserving old records that do not have household or actual-spending fields.
- Render summary metrics through existing summary view-model/rendering paths where practical.
- Reuse `financial-modal-controller.js` patterns or add a closely scoped Step 1.2 modal controller that follows the same draft/save conventions.
- Add targeted Playwright coverage in `tests/step1.spec.ts` for entry, optional spouse income, variable budget fields, compact status, projection, and regression safety.

</code_context>

<specifics>
## Specific Ideas

- The user chose the hybrid structure: compact summary panel plus detailed modal.
- The feature should be framed as newlywed household budgeting, but it must allow one partner's income to be missing.
- The user wants high information density with compact design; avoid bloating the Step 1 default screen.
- The user approved tracking target-vs-actual only for variable expenses.
- The user approved a simple month-progress projection for end-of-month spending.
- Explain budget fields in plain terms during planning: planned monthly variable spending versus this month's actual spending.

</specifics>

<deferred>
## Deferred Ideas

- Pasted Korean bank/card notification parsing into actual spending — Phase 11.
- Dual-flow ISF hash merge and household Sankey preview — Phase 12.
- Historical spending comparison chart — Phase 13.
- Real-estate affordability calculator — Phase 14.
- Transaction-history-based or recent-7-day forecasting — future extension after transaction capture exists.
- Live banking/account scraping — out of scope for v1.9.

</deferred>

---

*Phase: 10-Step 1.2 Household Budget Foundation*
*Context gathered: 2026-06-19*
