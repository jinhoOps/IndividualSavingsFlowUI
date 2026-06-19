# Phase 09: Step 1 Financial Settings Input UIUX Rebuild - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase rebuilds the Step 1 financial settings input experience in `apps/main` so it becomes a core preset-driven setup flow rather than a dense early-version editor. The work should make Step 1 feel closer to Step 3: users first see polished category cards/lists, open a card to inspect and edit details, and use guided creation flows for new financial data.

The phase includes Step 1 default-screen recomposition, category detail modals, guided item creation, preset-based quick financial setup, inline account selection/creation within item modals, automatic account allocation correction, and Sankey stability around a mandatory `총수입` node.

This phase should not add a detailed bank-account model, live banking integration, broad React migration, or a separate standalone account-management product surface.

</domain>

<decisions>
## Implementation Decisions

### Default Screen Structure
- **D-01:** The Step 1 default screen is split into two primary card/list groups: `수입+계좌` and `지출+저축+투자`.
- **D-02:** Inside those groups, show category cards for `수입`, `계좌`, `지출`, `저축`, and `투자`. Each card should show the total, item count, and a short representative item list.
- **D-03:** Clicking a category card opens a Step 3-style detail/edit modal. The default screen stays summary-oriented; detailed editing moves into modal flows.
- **D-04:** Sankey stays directly below the summary cards as immediate feedback, not hidden in a separate result-only tab.

### Preset Quick Setup
- **D-05:** Preset quick setup is a core Step 1 input feature, not a decorative shortcut. It should reduce the burden of manually entering many financial-setting rows.
- **D-06:** Users can generate `지출`, `저축`, and `투자` allocations at once from monthly income percentages.
- **D-07:** Expense preset output is grouped into four large groups: `고정비`, `변동비`, `행복비`, and `경조사비`.
- **D-08:** The built screen after preset application is primarily for detail inspection and correction, not for forcing users to build every row manually.
- **D-09:** Provide four default investment-attitude presets: `안정`, `균형`, `성장`, and `야수`. The meaningful difference is primarily the savings-vs-investment ratio; this should carry forward conceptually into Step 2 and Step 3.
- **D-10:** `사용자 지정` starts by copying the last selected preset's percentage values. It must not start blank unless no prior preset exists.
- **D-11:** Percentage inputs recalculate and normalize when focus leaves the field.
- **D-12:** The final confirmation supports both amount correction and percentage correction. Amount correction rounds cleanly to 10,000 KRW units; percentage correction preserves integer percentage intent.
- **D-13:** User-entered original percentages must remain visible in the final confirmation. They must not disappear just because generated Won amounts were rounded.

### Money Display Precision
- **D-28:** Korean money unit conversion should show only one lower unit below the largest displayed unit. If the amount is displayed in `억`, show down to `만` only; if displayed in `조`, show down to `억` only. Do not append smaller units such as `천원` once the display has moved up to `억`, and do not append `만` once the display has moved up to `조`.

### Item Creation Flow
- **D-14:** New item creation uses a dedicated guided creation modal: choose what to add, enter name/amount, choose the connected account, then confirm.
- **D-15:** Creation has a final confirmation screen like Step 3 portfolio creation, summarizing item name, amount, connected account, group/type, and any correction applied.
- **D-16:** Account connection is required, but the UI should preselect a recommended default account and allow the user to change it.
- **D-17:** The prior standalone account-management surface is considered a failed structure. Account creation, selection, and light editing should happen inside the relevant income/expense/savings/investment add/edit modal.

### Account Allocation Complexity
- **D-18:** Income defaults to one deposit account. Multi-account income allocation is available only when the user turns on a "split into multiple accounts" style option.
- **D-19:** Accounts are simple aliases such as `급여계좌`, `생활비계좌`, and `투자계좌`. Do not ask for bank name, balance, or detailed account type in this phase.
- **D-20:** Expense, savings, and investment cards/lists show only a small account badge by default. Account changes happen in the detail/edit modal.
- **D-21:** Existing data may lack withdrawal-account information. The system should automatically choose the most appropriate large/default account instead of leaving the item unusable.
- **D-22:** If allocation totals do not match item totals, automatically correct the difference into the recommended or largest suitable account and show a warning badge or correction note.

### Sankey Stability
- **D-23:** `총수입` is mandatory. It is the destination of individual income nodes and the starting point for downstream spending/saving/investment flow.
- **D-24:** The canonical Sankey structure is `개별 수입 → 총수입 → 계좌 → 지출/저축/투자`.
- **D-25:** Missing account connections follow the same automatic correction philosophy as financial settings. If Sankey detects an item as `미지정 계좌`, users can run a manual refresh to auto-correct and re-sort the flow.
- **D-26:** Basic Sankey mode shows a stable summary: `총수입 → 계좌 → 지출/저축/투자 총합`. Detailed mode expands groups and individual items.
- **D-27:** Hover information for merged nodes or links must be readable as a line-broken list. Do not cram all merged item metadata into one long tooltip line.

### the agent's Discretion
- The planner may choose exact modal component boundaries and filenames as long as Step 1 remains in the established vanilla ES module structure.
- The planner may choose exact preset percentages for `안정`, `균형`, `성장`, and `야수`, but must make the savings-vs-investment distinction obvious.
- The planner may choose the exact automatic-account recommendation heuristic, provided missing-account data is corrected deterministically and surfaced to the user.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap And Project State
- `.planning/ROADMAP.md` — Phase 09 goal and placement after Phase 08.
- `.planning/PROJECT.md` — Project purpose, local-first financial-flow tool direction, and current architecture notes.
- `.planning/REQUIREMENTS.md` — Prior design-system and account/Sankey requirements.
- `.planning/STATE.md` — Current workflow position and roadmap evolution.

### Prior Phase Context
- `.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-CONTEXT.md` — Step 1 vanilla ES module, DESIGN.md, mobile stability, and rendering-safety constraints.
- `.planning/phases/08-step-2-redesign-re-planning/08-CONTEXT.md` — Step 2 editorial decision-flow and Step 1 monthly-investment sync context.
- `.planning/phases/05-portfolio-creation-allocation-ui/05-CONTEXT.md` — Step 3-style portfolio creation, card, summary, confirmation, and percentage-allocation patterns.

### Design System
- `DESIGN.md` — Authoritative visual system and editorial UI direction.
- `shared/styles/step-theme.css` — Shared card, modal, button, and step-theme tokens.
- `shared/core/utils.js` — Shared Won formatting and Korean money unit conversion helpers.
- `src/styles/globals.css` — Global styling imported by Vite entries.

### Step 1 Source
- `apps/main/index.html` — Current Step 1 structure and integration points.
- `apps/main/app.js` — Current Step 1 orchestration entry.
- `apps/main/styles.css` — Current Step 1 layout and responsive surface.
- `apps/main/modules/dom.js` — DOM registry for new modal/card nodes.
- `apps/main/modules/state.js` — Step 1 state ownership boundary.
- `apps/main/modules/state-helpers.js` — State mutation and helper patterns.
- `apps/main/modules/input-sanitizer.js` — Existing validation/sanitization boundary.
- `apps/main/modules/list-renderer.js` — Current item/card/list rendering and account badge behavior.
- `apps/main/modules/item-editor-controller.js` — Existing item editing integration point.
- `apps/main/modules/ui-controller.js` — Summary sync and UI state patterns.
- `apps/main/modules/visualization-controller.js` — Sankey/network controls and refresh integration point.
- `apps/main/modules/sankey-builder.js` — Sankey data shape and required `총수입` restructure target.
- `apps/main/modules/sankey-renderer.js` — Sankey SVG rendering, tooltip, basic/detail behavior, and hover readability target.

### Step 3 Reference Implementation
- `apps/portfolio/app.js` — Existing Step 3 card/list, creator, confirmation, detail modal, and pending-change flow.
- `apps/portfolio/modules/dom.js` — Step 3 DOM rendering patterns for portfolio cards, creator form, detail modal, confirmation modal, and live percentage updates.
- `apps/portfolio/modules/state.js` — Step 3 state pattern for active creator and saved portfolio data.
- `apps/portfolio/modules/calculator.js` — Step 3 total/ratio calculation patterns relevant to preset percentages and amount correction.

### Tests
- `tests/step1.spec.ts` — Existing Step 1 Sankey, account, render safety, and mobile regression coverage.
- `tests/step2.spec.ts` — Step 2 post-redesign testing patterns for card/detail/mobile interactions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/portfolio/modules/dom.js`: Step 3 already has the target card → creator → confirmation → detail modal interaction pattern.
- `apps/main/modules/list-renderer.js`: Existing category item rendering, account badges, creator panel, and amount controls can guide the replacement surface.
- `apps/main/modules/item-editor-controller.js`: Natural integration point for moving edits into modal-based workflows.
- `apps/main/modules/sankey-builder.js`: Current Sankey starts from individual incomes; this is the key place to introduce the mandatory `총수입` node and stable canonical flow.
- `apps/main/modules/sankey-renderer.js`: Existing basic/detail modes, collapsed-node detail panel, and tooltip logic should be reused and improved for readable merged metadata.
- `shared/core/utils.js`: Use existing Won formatting, Korean Won hints, and HTML escaping helpers before adding new utilities.

### Established Patterns
- Step apps use vanilla ES modules under `apps/` with Vite entries in `src/entries/`.
- Internal financial values stay in Won; display may show Korean readable hints.
- DESIGN.md and shared step theme tokens should guide cards, modals, buttons, and compact editorial surfaces.
- Phase 07 established mobile stability and defensive rendering as hard constraints for Step 1 changes.

### Integration Points
- Default-screen card/list recomposition connects through `apps/main/index.html`, `apps/main/modules/dom.js`, and `apps/main/modules/list-renderer.js`.
- Guided creation and detail editing connect through `apps/main/modules/item-editor-controller.js`, `apps/main/modules/ui-controller.js`, and state helpers.
- Preset quick setup needs new logic near Step 1 state/calculation boundaries, likely under `apps/main/modules/` rather than embedded in renderers.
- Sankey refresh and correction should connect to `apps/main/modules/visualization-controller.js`, `apps/main/modules/sankey-builder.js`, and existing tests in `tests/step1.spec.ts`.

</code_context>

<specifics>
## Specific Ideas

- The user wants Step 1 to grow into a core financial-settings feature, not remain a brittle input gimmick.
- "Step 3-like" means polished default cards/lists, click-to-detail editing, guided creation, confirmation, and live percentage/amount feedback.
- The separate account-management UI should not be the main path anymore; account work belongs inside the modals where the user is already adding or editing financial items.
- Sankey must always have a `총수입` node. The user clarified that `총수입` is where incomes arrive and where spending/saving/investment flow begins.
- For merged Sankey hover details, readability matters: list items with deliberate line breaks instead of dense single-line metadata.
- Preset quick setup should let many users build a useful Step 1 plan from percentages first, then inspect and fine-tune details.
- Korean money hints should stay compact: once the display reaches `억`, include at most `만`; once it reaches `조`, include at most `억`.

</specifics>

<deferred>
## Deferred Ideas

- Detailed bank-account modeling with bank name, account type, and live balance.
- Live banking or transaction import.
- Broad React rewrite of Step 1.
- Separate standalone account-management product surface.

</deferred>

---

*Phase: 09-Step 1 Financial Settings Input UIUX Rebuild*
*Context gathered: 2026-06-18*
