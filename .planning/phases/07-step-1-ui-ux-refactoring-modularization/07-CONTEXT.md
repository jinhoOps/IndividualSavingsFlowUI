# Phase 7: Step 1 UI/UX Refactoring & Modularization - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase refactors Step 1 (`apps/step1`) so the household-flow experience is easier to maintain, visually aligned with `DESIGN.md`, and stable on mobile. The work is limited to Step 1 UI/UX, Step 1 CSS reduction, Step 1 module boundaries, and defensive handling at Step 1 rendering/data-ingest touchpoints.

Step 2 findings from the UI/UX code review are explicitly deferred to Phase 8. This phase should not redesign the Step 2 simulator, IndexedDB fallback behavior for Step 2, or Step 2 table responsiveness.

</domain>

<decisions>
## Implementation Decisions

### Step 1 UI Recomposition
- **D-01:** Preserve the current Step 1 panel sequence as the baseline cognitive flow: Summary, Visualization, Controls, Projection, then Comparison. The redesign should improve density, hierarchy, spacing, and mobile stability without changing the user's mental model.
- **D-02:** Apply `DESIGN.md` more consistently through ISF Pearl canvas, flat editorial panels, solid borders, Gowun Batang display typography, Gowun Dodum body typography, and physical button feedback.
- **D-03:** Avoid a full marketing-style redesign. Step 1 remains a working financial input surface, so the UI should be calmer, denser, and more operational than decorative.
- **D-04:** Mobile layout at 768px and below is a hard acceptance target. Panels may collapse or stack, but fields, tabs, action menus, and chart controls must not clip or overlap.

### CSS Cleanup And Theme Consolidation
- **D-05:** Reduce `apps/step1/styles.css` by removing dead CSS, consolidating duplicate rules, and replacing one-off values with existing design tokens from `DESIGN.md` and `shared/styles`.
- **D-06:** Prefer theme consolidation before physical CSS splitting. If splitting is needed, use a small number of obvious boundaries: shared/theme tokens, Step 1 layout, Step 1 components, and Step 1 responsive rules.
- **D-07:** Preserve media-query integrity during edits. The planner must include a line-count or targeted grep check around mobile `@media` sections because prior work identifies CSS truncation as a recurring risk.
- **D-08:** Keep Step 1's existing visual language: ISF Sunset primary, ISF Deep Sea accent, Pearl canvas, flat white panels, and <= 8px card/control radius unless an existing token says otherwise.

### App.js Modularization
- **D-09:** Extract the largest Step 1 responsibilities from `apps/step1/app.js`: initialization flow, event binding, visualization/tooltip bindings, render orchestration, and persistence/backup handlers.
- **D-10:** Keep small orchestration helpers in place when moving them would increase risk or create churn. The goal is to remove the giant controller shape, not to chase perfect purity.
- **D-11:** Preserve the established 3-layer pattern: `state.js` owns state, helper/calculator modules stay DOM-light, and renderer/controller modules handle DOM synchronization.
- **D-12:** Avoid broad migration to React in this phase. Step 1 remains vanilla ES modules unless a very small shared component already exists and fits the current compatibility bridge.

### Rendering, Escaping, And Runtime Guards
- **D-13:** Treat `innerHTML` renderers as review targets. Existing `IsfUtils.escapeHtml` usage should be preserved and missing escaping should be added where user-controlled values, imported data, or merged ISF CODE content can reach markup.
- **D-14:** Add lightweight runtime guards at external data and merge boundaries before data reaches IndexedDB or renderers. Use existing `sanitizeInputs` and local validators first; add a new small schema utility only if existing helpers cannot express the required checks.
- **D-15:** Clarify `IsfUtils.toWon` and `IsfUtils.toMan` semantics in code/docs if they are currently 1:1 pass-through helpers. The planner should prevent double conversion bugs by aligning names, comments, and usage.
- **D-16:** Performance improvements should focus on practical Step 1 pain points: avoid unnecessary full re-renders during resize/zoom, keep Sankey and network-map redraws bounded, and do not introduce a new charting dependency for this phase.

### The Agent's Discretion
- The agent may choose exact module filenames and extraction order as long as the files remain under `apps/step1/modules/` and follow existing ES module style.
- The agent may decide whether CSS is physically split after measuring actual duplication and import constraints.
- The agent may choose specific mobile collapse behavior for lower-priority panels, provided the 768px layout stays intact and the main input workflow remains reachable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap And Requirements
- `.planning/ROADMAP.md` — Phase 7 goal and success criteria: reduce `styles.css` by 50%+, modularize `app.js`, and keep <=768px mobile layout stable.
- `.planning/REQUIREMENTS.md` — Active milestone requirements and prior UI design-system requirements.
- `.planning/PROJECT.md` — Project purpose, current architecture, and key decisions.
- `.planning/STATE.md` — Current workflow position and Phase 7 status.

### Design System
- `DESIGN.md` — Authoritative ISF visual system: Pearl canvas, flat editorial panels, typography, spacing, feedback, and responsive behavior.
- `shared/styles/` — Shared theme/style assets to reuse before adding Step 1-only CSS.

### Step 1 Source
- `apps/step1/app.js` — Current Step 1 orchestrator and primary modularization target.
- `apps/step1/styles.css` — Current large stylesheet and primary CSS reduction target.
- `apps/step1/index.html` — Step 1 structure and panel order.
- `apps/step1/modules/dom.js` — DOM registry and integration point for controller extraction.
- `apps/step1/modules/ui-controller.js` — Existing UI synchronization patterns.
- `apps/step1/modules/list-renderer.js` — Existing `innerHTML` renderer and escaping review target.
- `apps/step1/modules/sankey-renderer.js` — SVG redraw and performance review target.
- `apps/step1/modules/network-map-renderer.js` — Account-flow visualization and mobile layout review target.
- `apps/step1/modules/state.js` — State ownership boundary.
- `apps/step1/modules/state-helpers.js` — Existing state helper boundary.
- `apps/step1/modules/input-sanitizer.js` — Existing sanitization and runtime guard boundary.
- `shared/core/utils.js` — Currency helpers, escaping, formatting, and utility semantics.

### Prior Decisions
- `.planning/phases/03-multi-account-data-model/03-CONTEXT.md` — Sankey simplification and account-transfer-board decisions that Step 1 must preserve.
- `.planning/phases/04-account-transfer-ui-ux-polish/04-CONTEXT.md` — Step 1 visualization tabs, network map, tooltip, and warning indicator decisions.
- `.planning/phases/05-portfolio-creation-allocation-ui/05-CONTEXT.md` — Editorial card and amount-hint patterns relevant to consistency.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IsfUtils.escapeHtml`, `formatMoney`, `convertToKoreanWon`, `toWon`, and `toMan`: use these before adding new display or currency helpers.
- `sanitizeInputs` and `input-sanitizer.js`: use as the first line of defense for loaded, imported, or merged Step 1 data.
- `dom.js`: central registry for extracted controller modules; avoid scattering repeated `querySelector` calls.
- `ui-controller.js`: existing synchronization module that can absorb more UI state syncing after `app.js` extraction.
- `list-renderer.js`: rendering target for row/card cleanup and XSS hardening.

### Established Patterns
- Step apps use vanilla ES modules under `apps/step*/` and shared TypeScript/React only through compatibility bridges where appropriate.
- Step 1 follows a 3-layer structure: state, helper/logic, and UI/renderer modules.
- Internal financial values must stay in Won; UI display may format for readability but must not mutate stored units.
- Mobile CSS integrity is a known project constraint; responsive rules must be verified after CSS edits.

### Integration Points
- `apps/step1/app.js` should become a thin coordinator over extracted modules.
- `apps/step1/styles.css` should delegate token-level concerns to existing shared theme assets where available.
- Step 1 renderers should harden all HTML string generation around external/imported/user-controlled values.
- Existing PWA/storage bridge behavior should be preserved; global bridge replacement is not in scope except for defensive checks where Step 1 currently assumes globals exist.

</code_context>

<specifics>
## Specific Ideas

- The user selected all four discussion areas in this order: Step 1 UI recomposition, CSS cleanup, `app.js` modularization, and rendering/schema safety.
- The UI/UX review report is accepted as supporting evidence for Step 1 technical debt: `app.js` remains about 1,250 lines, `styles.css` is large, `innerHTML` rendering is mixed, and mobile CSS damage is a known risk.
- Step 2 review findings are not lost, but they belong to Phase 8 because that roadmap phase covers Step 2 redesign and replanning.

</specifics>

<deferred>
## Deferred Ideas

- Step 2 IndexedDB fallback and private-mode storage behavior — Phase 8.
- Step 2 initial-data warning banner UX — Phase 8.
- Step 2 simulation table mobile redesign — Phase 8.
- Broad React migration for Step 1 — future modernization phase unless separately scoped.
- Replacing the storage/global bridge architecture wholesale — future architecture phase.

</deferred>

---

*Phase: 07-Step 1 UI/UX Refactoring & Modularization*
*Context gathered: 2026-06-16*
