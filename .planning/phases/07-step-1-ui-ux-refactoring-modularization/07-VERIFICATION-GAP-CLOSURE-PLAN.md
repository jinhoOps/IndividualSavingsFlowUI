---
phase: 07-step-1-ui-ux-refactoring-modularization
plan: verification-gap-closure
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/main/modules/bootstrap-controller.js
  - apps/main/modules/event-bindings.js
  - apps/main/modules/persistence-controller.js
  - apps/main/modules/render-orchestrator.js
  - apps/main/modules/visualization-controller.js
  - apps/main/modules/item-editor-controller.js
  - apps/main/modules/ui-controller.js
  - apps/main/modules/list-renderer.js
  - tests/step1.spec.ts
autonomous: true
gap_closure: true
source: 07-VERIFICATION.md
status: planned
created: 2026-06-17
requirements:
  - UI-01
  - UI-02
requirements_addressed:
  - UI-01
  - UI-02
user_setup: []
must_haves:
  truths:
    - "Step 1 controller responsibilities are split out of apps/main/modules/bootstrap-controller.js per D-09, D-10, D-11, and D-12."
    - "apps/main/modules/ui-controller.js no longer interpolates user/imported group names into datalist innerHTML per D-13 and D-14."
    - "Allocation group directories repeatedly collapse and expand after previous Phase 07 tests have changed viewport, tabs, inputs, storage, and render state."
    - "The full Phase 07 Playwright group passes with npx playwright test tests/step1.spec.ts -g \"Phase 07\" --reporter=list --timeout=30000."
  artifacts:
    - path: "apps/main/modules/bootstrap-controller.js"
      provides: "Startup-only Step 1 bootstrap over focused controllers"
      max_lines: 350
      exports: ["startStep1App"]
    - path: "apps/main/modules/event-bindings.js"
      provides: "Top-level DOM event registration and global event wiring"
      exports: ["bindStep1Events"]
    - path: "apps/main/modules/persistence-controller.js"
      provides: "Primary save, import, export, reset, hash, share, backup, and restore handlers"
      exports: ["createPersistenceController"]
    - path: "apps/main/modules/render-orchestrator.js"
      provides: "renderAll, projection mode, and visible input orchestration"
      exports: ["createRenderOrchestrator"]
    - path: "apps/main/modules/visualization-controller.js"
      provides: "Visualization tabs, tooltip behavior, and Sankey mode handlers"
      exports: ["createVisualizationController"]
    - path: "apps/main/modules/item-editor-controller.js"
      provides: "Item editor lifecycle, mutation handlers, and allocation validation"
      exports: ["createItemEditorController"]
    - path: "apps/main/modules/ui-controller.js"
      provides: "Safe datalist option synchronization"
      exports: ["syncGroupOptionsFor"]
    - path: "apps/main/modules/list-renderer.js"
      provides: "Allocation group details rendering that preserves user open/closed state"
    - path: "tests/step1.spec.ts"
      provides: "Full Phase 07 regression coverage for repeated allocation group collapse/expand"
  key_links:
    - from: "apps/main/modules/bootstrap-controller.js"
      to: "apps/main/modules/render-orchestrator.js"
      via: "createRenderOrchestrator dependency object"
      pattern: "createRenderOrchestrator"
    - from: "apps/main/modules/bootstrap-controller.js"
      to: "apps/main/modules/persistence-controller.js"
      via: "createPersistenceController dependency object"
      pattern: "createPersistenceController"
    - from: "apps/main/modules/event-bindings.js"
      to: "apps/main/modules/item-editor-controller.js"
      via: "bindStep1Events command object"
      pattern: "bindStep1Events"
    - from: "apps/main/modules/ui-controller.js"
      to: "datalist option nodes"
      via: "document.createElement('option') and replaceChildren"
      pattern: "replaceChildren"
    - from: "tests/step1.spec.ts"
      to: "apps/main/modules/list-renderer.js"
      via: "Phase 07 allocation group repeated close/open/close assertion"
      pattern: "allocation-group"
---

<objective>
Close the remaining Phase 07 verification gaps without rewriting completed Phase 07 plans.

Purpose: `07-VERIFICATION.md` still fails the actual Step 1 runtime on four truths: controller responsibility splitting, safe group-option rendering, repeated collapsible allocation group behavior in the full Phase 07 Playwright group, and the final automated Phase 07 gate. This plan covers those failures directly while preserving the completed CSS reduction, panel order, reset, money input, taxonomy, account-flow, and Sankey metadata work.

Output: One verification gap-closure implementation with focused controller modules, safe datalist rendering, reliable allocation group collapse behavior, passing Phase 07 Playwright gate, and a new execution summary.
</objective>

<execution_context>
@C:/Users/LENOVO/.codex/gsd-core/workflows/execute-plan.md
@C:/Users/LENOVO/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-CONTEXT.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/RESEARCH.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-PATTERNS.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-VERIFICATION.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-01-SUMMARY.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-02-SUMMARY.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-03-SUMMARY.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-GAP-CLOSURE-SUMMARY.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT-RERUN-GAP-SUMMARY.md
@.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT-SECOND-RERUN-GAP-SUMMARY.md
@apps/main/app.js
@apps/main/modules/bootstrap-controller.js
@apps/main/modules/dom.js
@apps/main/modules/state.js
@apps/main/modules/state-helpers.js
@apps/main/modules/input-sanitizer.js
@apps/main/modules/external-input-guard.js
@apps/main/modules/ui-controller.js
@apps/main/modules/list-renderer.js
@apps/main/modules/sankey-renderer.js
@apps/main/modules/network-map-renderer.js
@tests/step1.spec.ts
@playwright.config.ts
</context>

<discovery>
Level 0 - existing-code gap closure. No new dependency, package install, external API, framework change, or discovery document is required. Use `07-PATTERNS.md` as the binding pattern map for the actual `apps/main` runtime.
</discovery>

<dependency_graph>
Task 1 extracts event, persistence, and render orchestration responsibilities. Task 2 depends on Task 1 and extracts visualization and item-editor responsibilities, then makes `bootstrap-controller.js` startup-only. Task 3 depends on the stabilized controller boundary and closes safe datalist rendering, allocation collapse reliability, and the full Phase 07 Playwright gate. Prior Phase 07 gap plans are completed context through SUMMARY files, not execution blockers, so this plan has no plan-level `depends_on`.
</dependency_graph>

<artifacts_this_phase_produces>
- `apps/main/modules/event-bindings.js` creates `bindStep1Events(commands)`.
- `apps/main/modules/persistence-controller.js` creates `createPersistenceController(deps)` and returned handlers `commitImmediateInputs`, `persistPrimaryState`, `handleManualBackup`, `restoreBackupById`, `handleExportJson`, `handleImportJson`, `handleSaveViewToLocal`, `handleResetInputs`, `handleHashChange`, `initializeBackupStore`, and `initializeInputsFromShareId`.
- `apps/main/modules/render-orchestrator.js` creates `createRenderOrchestrator(deps)` and returned handlers `renderAll`, `setProjectionMode`, and `getVisibleInputs`.
- `apps/main/modules/visualization-controller.js` creates `createVisualizationController(deps)` and returned handlers `bindVisualizationAndTooltipEvents`, `setSankeyValueMode`, `setSankeySortMode`, `setSankeyGrouping`, and `setSankeyDetailMode`.
- `apps/main/modules/item-editor-controller.js` creates `createItemEditorController(deps)` and returned handlers `bindItemEditorEvents`, `toggleItemEditor`, `startItemEditor`, `applyItemEditor`, `cancelItemEditor`, `addItemToEditor`, `closeAllItemEditors`, `navigateToAdvancedGroup`, and `getActiveItemEditorGroupKey`.
- `apps/main/modules/ui-controller.js` keeps `syncGroupOptionsFor(group)` but changes it to DOM-built datalist options.
- `apps/main/modules/list-renderer.js` keeps grouped allocation rendering and adds deterministic open/closed state preservation for allocation `details`.
- `tests/step1.spec.ts` contains a full Phase 07 repeated close/open/close regression that passes in the full `-g "Phase 07"` group.
- `.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-VERIFICATION-GAP-CLOSURE-SUMMARY.md` is created by execution when the plan is complete.
</artifacts_this_phase_produces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract event, persistence, and render controllers from bootstrap-controller.js</name>
  <read_first>
    @.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-PATTERNS.md
    @.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-VERIFICATION.md
    @apps/main/modules/bootstrap-controller.js
    @apps/main/modules/state.js
    @apps/main/modules/state-helpers.js
    @apps/main/modules/input-sanitizer.js
    @apps/main/modules/external-input-guard.js
    @apps/main/modules/ui-controller.js
    @apps/main/modules/list-renderer.js
    @apps/main/modules/sankey-renderer.js
    @apps/main/modules/network-map-renderer.js
  </read_first>
  <files>apps/main/modules/bootstrap-controller.js, apps/main/modules/event-bindings.js, apps/main/modules/persistence-controller.js, apps/main/modules/render-orchestrator.js</files>
  <behavior>
    - `startStep1App()` still starts exactly once on DOMContentLoaded or immediately when the document is ready.
    - Startup still runs returning-user checks, onboarding/PWA setup, backup store initialization, share-id loading, snapshot selector initialization, management tab initialization, group option sync, and first render through extracted command objects.
    - Render order still flows through visible inputs, monthly snapshot, projection, summary cards, warnings, Sankey/network renderers, transfer UI, projection table, input hints, and form refresh.
    - JSON import, ISF CODE apply/merge, URL hash restore, share-id load, backup restore, reset, view-mode save, and primary persistence still pass through `normalizeExternalStep1Inputs()` or existing `sanitizeInputs()` before commit.
  </behavior>
  <action>Extract the first ordered controller slice from the current 1,259-line `apps/main/modules/bootstrap-controller.js`. Create `event-bindings.js` for shared top-level DOM event registration, form tracking, action buttons, readonly navigation, modal/global events, management tab wiring, and mobile controls that can be expressed through a passed command object. Create `persistence-controller.js` for `commitImmediateInputs`, `persistPrimaryState`, manual backup, restore, JSON import/export, view-save, reset, hash-change, share-id loading, and ISF CODE apply/merge/generate. Create `render-orchestrator.js` for `renderAll`, `setProjectionMode`, and visible-input orchestration. Keep `state.js` as the state owner, keep calculator/helper modules DOM-light, and keep controllers/renderers responsible for DOM synchronization per D-11. Wire these modules from `bootstrap-controller.js` using explicit dependency objects or command objects so imports stay acyclic. Preserve D-01 through D-08 UI/CSS behavior, D-14 external input guards, D-15 current Won helper semantics, and D-16 no-new-chart-dependency behavior. Do not move Step 1 into React per D-12.</action>
  <verify>
    <automated>node --check apps/main/modules/bootstrap-controller.js</automated>
    <automated>node --check apps/main/modules/event-bindings.js</automated>
    <automated>node --check apps/main/modules/persistence-controller.js</automated>
    <automated>node --check apps/main/modules/render-orchestrator.js</automated>
    <automated>npm run check</automated>
    <automated>powershell -NoProfile -Command "rg -n \"bindStep1Events|createPersistenceController|createRenderOrchestrator\" apps/main/modules/bootstrap-controller.js apps/main/modules/event-bindings.js apps/main/modules/persistence-controller.js apps/main/modules/render-orchestrator.js"</automated>
  </verify>
  <acceptance_criteria>
    - `event-bindings.js`, `persistence-controller.js`, and `render-orchestrator.js` exist, export the symbols listed in `artifacts_this_phase_produces`, and are wired from `bootstrap-controller.js`.
    - `bootstrap-controller.js` no longer contains persistence/import/share/hash handler bodies or the `renderAll` orchestration body.
    - Every external/import/share/hash/backup/reset path moved in this task still passes through `normalizeExternalStep1Inputs()` or `sanitizeInputs()` before state commit.
    - `npm run check` passes after extraction.
  </acceptance_criteria>
  <done>The event, persistence, and render orchestration parts of the mega-controller split are extracted and wired without regressing startup, storage, import/share/hash, or render behavior.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extract visualization and item-editor controllers, then finalize bootstrap boundary</name>
  <read_first>
    @.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-PATTERNS.md
    @.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-VERIFICATION.md
    @apps/main/modules/bootstrap-controller.js
    @apps/main/modules/event-bindings.js
    @apps/main/modules/render-orchestrator.js
    @apps/main/modules/state.js
    @apps/main/modules/state-helpers.js
    @apps/main/modules/list-renderer.js
    @apps/main/modules/sankey-renderer.js
    @apps/main/modules/network-map-renderer.js
  </read_first>
  <files>apps/main/modules/bootstrap-controller.js, apps/main/modules/event-bindings.js, apps/main/modules/visualization-controller.js, apps/main/modules/item-editor-controller.js</files>
  <behavior>
    - Visualization tabs, tooltip behavior, Sankey value/sort/group/detail setters, transfer-rule UI events, and bounded resize redraw behavior remain identical from the user's perspective.
    - Item editor open/apply/cancel/add, mobile editor lifecycle, close-all behavior, advanced-group navigation, delegated input/click handling, and income allocation total validation still update state through the existing sanitizer and pending-change path.
    - `bootstrap-controller.js` becomes startup-only: it imports controllers, builds dependency/command objects, starts initialization, and contains no persistence, render, visualization, or item-editor mutation bodies.
  </behavior>
  <action>Extract the remaining controller responsibilities from `bootstrap-controller.js` per D-09 through D-12. Create `visualization-controller.js` for visualization tab events, tooltip behavior, Sankey value/sort/group/detail setters, transfer-rule UI events, and bounded resize redraw behavior. Create `item-editor-controller.js` for `bindItemEditorEvents`, item input/click handling, editor start/apply/cancel/add, mobile editor lifecycle, close-all behavior, advanced-group navigation, and income allocation total validation. Update `event-bindings.js` and `bootstrap-controller.js` so event wiring receives the visualization and item-editor handlers through explicit command objects. Keep renderer calls delegated to `sankey-renderer.js`, `network-map-renderer.js`, and `list-renderer.js`; keep state mutation through `state.js`, `state-helpers.js`, and `sanitizeInputs()` per D-11. Preserve D-01 through D-08 UI/CSS behavior, D-15 current Won helper semantics, and D-16 no-new-chart-dependency behavior.</action>
  <verify>
    <automated>node --check apps/main/modules/bootstrap-controller.js</automated>
    <automated>node --check apps/main/modules/event-bindings.js</automated>
    <automated>node --check apps/main/modules/persistence-controller.js</automated>
    <automated>node --check apps/main/modules/render-orchestrator.js</automated>
    <automated>node --check apps/main/modules/visualization-controller.js</automated>
    <automated>node --check apps/main/modules/item-editor-controller.js</automated>
    <automated>npm run check</automated>
    <automated>powershell -NoProfile -Command "$lines=(Get-Content apps\main\modules\bootstrap-controller.js).Count; if ($lines -gt 350) { throw \"bootstrap-controller.js remains too large: $lines lines\" }; Write-Output \"bootstrap-controller.js lines=$lines\""</automated>
    <automated>powershell -NoProfile -Command "rg -n \"bindStep1Events|createPersistenceController|createRenderOrchestrator|createVisualizationController|createItemEditorController\" apps/main/modules/bootstrap-controller.js apps/main/modules/event-bindings.js apps/main/modules/persistence-controller.js apps/main/modules/render-orchestrator.js apps/main/modules/visualization-controller.js apps/main/modules/item-editor-controller.js"</automated>
    <automated>powershell -NoProfile -Command "$matches=rg -n \"function (bindControls|bindVisualizationAndTooltipEvents|renderAll|commitImmediateInputs|handleHashChange|applyItemEditor)\" apps/main/modules/bootstrap-controller.js; if ($LASTEXITCODE -eq 0) { $matches; throw 'Mega-controller function bodies remain in bootstrap-controller.js' }; if ($LASTEXITCODE -gt 1) { throw 'rg failed while checking bootstrap-controller.js' }; Write-Output 'bootstrap-controller.js contains no blocked controller function bodies'"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/main/modules/bootstrap-controller.js` is at or below 350 physical lines and no longer contains persistence/import/share/hash handlers, render orchestration, visualization bindings, or item-editor mutation bodies.
    - All five focused controller modules exist, export the symbols listed in `artifacts_this_phase_produces`, and are wired from `bootstrap-controller.js`.
    - Visualization and item-editor interactions still use existing renderer/helper/state boundaries and do not introduce a React migration or new chart dependency.
    - `npm run check` passes after the complete controller extraction.
  </acceptance_criteria>
  <done>The mega-controller split is complete with focused controller modules and no regression to Step 1 startup, persistence, rendering, visualization, or item-editor behavior.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Close safe rendering, allocation collapse, and full Phase 07 gate gaps</name>
  <read_first>
    @.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-PATTERNS.md
    @.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-VERIFICATION.md
    @apps/main/modules/ui-controller.js
    @apps/main/modules/list-renderer.js
    @apps/main/modules/input-sanitizer.js
    @apps/main/modules/state.js
    @.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-UAT-SECOND-RERUN-GAP-SUMMARY.md
    @tests/step1.spec.ts
    @playwright.config.ts
  </read_first>
  <files>apps/main/modules/ui-controller.js, apps/main/modules/list-renderer.js, tests/step1.spec.ts, playwright.config.ts</files>
  <behavior>
    - Group datalist values originating from user/imported `item.group` data are created with DOM APIs and are never interpolated into `innerHTML`.
    - Allocation group `details` elements can close, open, and close again in the active UI without being reopened by render refresh, pending form commits, or prior Phase 07 test state.
    - The first allocation group may default open on initial render, but once the user changes a group open state, subsequent renders preserve the user's chosen state for that group key.
    - Each Phase 07 test starts from deterministic browser storage and app state while preserving real app initialization.
    - The full `-g "Phase 07"` group passes when run as one command, not only when the final test is run alone.
    - Service worker blocking remains active for Playwright so tests read current dev-server files.
  </behavior>
  <action>Change `syncGroupOptionsFor(group)` in `ui-controller.js` so it calls `list.replaceChildren(...options)` with `document.createElement("option")`, assigning `option.value` and `option.textContent` from each normalized group name. Do not depend on `normalizeAllocationGroupName()` for escaping; it trims and slices only. In `list-renderer.js`, make grouped allocation rendering preserve per-group open/closed state across re-renders. Use a deterministic key from the list type and group name, read existing `details[data-allocation-group]` state before replacing the list contents, and apply that state when rebuilding the details markup or DOM nodes. Keep default first-group-open behavior only when no existing state is known for that key. Ensure delegated item click/input handling does not treat clicks on `.allocation-group__summary` as item mutations. Strengthen `tests/step1.spec.ts` setup and helpers so full-suite order cannot leak storage, viewport, active tabs, pending debounced renders, or details open state into later Phase 07 tests. Keep `playwright.config.ts` service worker blocking in place. Add a before-each storage reset using Playwright-supported browser APIs before app scripts initialize, then navigate to `apps/main/index.html` and wait for the Step 1 main surface. Add small local test helpers for opening the controls panel, switching management tabs, waiting for render/persistence debounce completion, and setting/asserting allocation `details.open` through user-visible summary clicks. Do not remove existing Phase 07 assertions; make the final allocation test prove both the `details.open` property and `.allocation-group__items` visibility through close, open, and close after the money-input/editing flow has already triggered render and persistence behavior. If an additional JS module is changed while making the gate pass, add a matching `node --check` command to the verification list and summary.</action>
  <verify>
    <automated>node --check apps/main/modules/ui-controller.js</automated>
    <automated>node --check apps/main/modules/list-renderer.js</automated>
    <automated>node --check apps/main/modules/bootstrap-controller.js</automated>
    <automated>node --check apps/main/modules/event-bindings.js</automated>
    <automated>node --check apps/main/modules/persistence-controller.js</automated>
    <automated>node --check apps/main/modules/render-orchestrator.js</automated>
    <automated>node --check apps/main/modules/visualization-controller.js</automated>
    <automated>node --check apps/main/modules/item-editor-controller.js</automated>
    <automated>npm run check</automated>
    <automated>powershell -NoProfile -Command "$matches=rg -n 'list\.innerHTML\s*=\s*names\.map|<option value=' apps/main/modules/ui-controller.js; if ($LASTEXITCODE -eq 0) { $matches; throw 'Unsafe group option interpolation remains' }; if ($LASTEXITCODE -gt 1) { throw 'rg failed while checking group options' }; Write-Output 'No unsafe group option interpolation found'"</automated>
    <automated>npx playwright test tests/step1.spec.ts -g "Phase 07 rerun formats money fields and groups long item lists" --reporter=list --timeout=30000</automated>
    <automated>npx playwright test tests/step1.spec.ts -g "Phase 07" --reporter=list --timeout=30000</automated>
  </verify>
  <acceptance_criteria>
    - `syncGroupOptionsFor()` uses `document.createElement("option")` and `replaceChildren()` for group datalist options.
    - No raw `<option value="${...}">` or equivalent group-name template interpolation remains in `ui-controller.js`.
    - `list-renderer.js` preserves user open/closed state for allocation groups across a render refresh.
    - The focused allocation group Playwright test passes and proves repeated close/open/close with the same locator.
    - The full Phase 07 Playwright group reports all Phase 07 tests passing in a single run.
    - The final allocation group test no longer relies on isolated execution and includes deterministic waits around render/persistence debounce points.
    - Every changed JS module has a passing `node --check` command recorded in the execution summary.
  </acceptance_criteria>
  <done>The safe-rendering gap, production-side collapsible allocation group reliability gap, and final automated Phase 07 Playwright gate are all closed.</done>
</task>

</tasks>

<post_execution_verification>
After every shell-runnable `<automated>` command in this plan passes, run the conversational UAT workflow `$gsd-verify-work 7` and record the result in Phase 07 UAT artifacts. This workflow invocation is intentionally not an automated shell command.
</post_execution_verification>

<source_audit>
| SOURCE | ID | Feature/Requirement | Plan | Status | Notes |
|---|---|---|---|---|
| GOAL | Phase 07 | Step 1 CSS diet, module splitting, DESIGN.md-aligned UI/UX | 07-VERIFICATION-GAP-CLOSURE | COVERED | Remaining failed truths are module splitting, safe rendering, collapse reliability, and final gate. CSS/panel/mobile truths are already verified in `07-VERIFICATION.md`. |
| REQ | UI-01 | DESIGN.md editorial UI adoption | 07-VERIFICATION-GAP-CLOSURE | COVERED | Tasks 1-3 preserve the already verified panel/order/theme work while closing controller and gate gaps. |
| REQ | UI-02 | Pearl canvas and serif/sans typography | 07-VERIFICATION-GAP-CLOSURE | COVERED | No CSS rewrite is planned; tests protect verified Phase 07 layout behavior. |
| RESEARCH | R-01 | Extract controller responsibilities from `bootstrap-controller.js` | Task 1, Task 2 | COVERED | Creates event, persistence, render, visualization, and item-editor controllers. |
| RESEARCH | R-02 | Safe option construction for user/imported values | Task 3 | COVERED | Replaces datalist `innerHTML` with DOM-built options. |
| RESEARCH | R-03 | Preserve allocation groups and full Phase 07 Playwright reliability | Task 3 | COVERED | Production open-state preservation plus full-suite test isolation. |
| RESEARCH | R-04 | No new package or chart dependency | Task 1, Task 2, Task 3 | COVERED | Uses existing vanilla ES modules and Playwright. |
| CONTEXT | D-01 | Preserve Summary, Visualization, Controls, Projection, Comparison flow | Task 1, Task 2, Task 3 | COVERED | Existing verified flow must remain passing in Phase 07 tests. |
| CONTEXT | D-02 | Apply DESIGN.md Pearl/panel/typography/feedback | Task 3 | COVERED | Full Phase 07 group protects existing verified design behavior. |
| CONTEXT | D-03 | Avoid marketing-style redesign | Task 1, Task 2 | COVERED | Refactor is controller/module work only, not a visual redesign. |
| CONTEXT | D-04 | Mobile <=768px hard acceptance | Task 3 | COVERED | Full Phase 07 mobile containment tests remain part of required gate. |
| CONTEXT | D-05 | CSS reduction via cleanup/token consolidation | Task 3 | COVERED | Already verified; this plan does not reopen CSS size work. |
| CONTEXT | D-06 | Prefer theme consolidation before splitting | Task 3 | COVERED | No CSS split is introduced by this gap closure. |
| CONTEXT | D-07 | Preserve media-query integrity | Task 3 | COVERED | Existing Phase 07 mobile tests remain in the final gate. |
| CONTEXT | D-08 | Keep Step 1 visual language and <=8px radii | Task 3 | COVERED | Existing radius and visual tests stay active. |
| CONTEXT | D-09 | Extract largest app/controller responsibilities | Task 1, Task 2 | COVERED | Direct target of ordered controller module extraction. |
| CONTEXT | D-10 | Keep small helpers only when moving increases churn | Task 2 | COVERED | Bootstrap may keep startup-only helpers, with line-count and function-body gates. |
| CONTEXT | D-11 | Preserve 3-layer state/helper/UI pattern | Task 1, Task 2 | COVERED | State remains in `state.js`; helpers/calculators stay DOM-light; controllers/renderers handle DOM. |
| CONTEXT | D-12 | Avoid broad React migration | Task 1, Task 2 | COVERED | Vanilla ES module extraction only. |
| CONTEXT | D-13 | Treat `innerHTML` renderers as review targets | Task 3 | COVERED | Datalist gap is closed with DOM-built options. |
| CONTEXT | D-14 | Add lightweight runtime guards at external data boundaries | Task 1 | COVERED | Existing `external-input-guard.js` and `sanitizeInputs` paths must remain wired after extraction. |
| CONTEXT | D-15 | Clarify/preserve `toWon` and `toMan` semantics | Task 1 | COVERED | Extraction must preserve current Won helper behavior and avoid unit conversion changes. |
| CONTEXT | D-16 | Bound practical redraws and avoid chart dependency | Task 2, Task 3 | COVERED | Visualization controller uses existing renderer/debounce patterns and final tests cover visualization. |
| CONTEXT | Deferred | Step 2 storage/table/mobile work | NONE | EXCLUDED | Explicitly scoped to Phase 8, not part of this verification gap closure. |
| CONTEXT | Deferred | Broad React migration and global storage replacement | NONE | EXCLUDED | Explicitly out of Phase 07 scope. |
</source_audit>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| imported/user group names -> datalist DOM | User/imported group values cross from Step 1 state into datalist option attributes and text. |
| external/share/hash/backup data -> Step 1 state | Restored data crosses into persistence and rendering paths during controller extraction. |
| repeated render/persistence events -> allocation group UI | Debounced render and storage updates can overwrite interactive details state. |
| automated verification -> phase completion | The phase can only close if full Phase 07 automated checks pass as one group. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|---|---|---|---|---|
| T-07-VGC-01 | Tampering | `ui-controller.js` `syncGroupOptionsFor` | mitigate | Build datalist options with `document.createElement("option")`, `value`, `textContent`, and `replaceChildren()`. |
| T-07-VGC-02 | Denial of Service | `list-renderer.js` allocation groups | mitigate | Preserve user open/closed state across renders and ignore summary clicks in item mutation handlers. |
| T-07-VGC-03 | Tampering | `persistence-controller.js` extraction | mitigate | Keep `normalizeExternalStep1Inputs()` / `sanitizeInputs()` before every external commit path after extraction. |
| T-07-VGC-04 | Repudiation | `tests/step1.spec.ts` final gate | mitigate | Require full Phase 07 Playwright command as automated evidence and `$gsd-verify-work 7` as a separate post-execution UAT workflow evidence item. |
| T-07-SC | Tampering | npm installs | accept | No package-manager install is planned or allowed for this gap closure. |
</threat_model>

<verification>
Required overall checks after all tasks:

- `node --check apps/main/modules/bootstrap-controller.js`
- `node --check apps/main/modules/event-bindings.js`
- `node --check apps/main/modules/persistence-controller.js`
- `node --check apps/main/modules/render-orchestrator.js`
- `node --check apps/main/modules/visualization-controller.js`
- `node --check apps/main/modules/item-editor-controller.js`
- `node --check apps/main/modules/ui-controller.js`
- `node --check apps/main/modules/list-renderer.js`
- `npm run check`
- `npx playwright test tests/step1.spec.ts -g "Phase 07" --reporter=list --timeout=30000`

Post-execution workflow after the shell checks pass: run `$gsd-verify-work 7` as conversational UAT verification, not as an automated shell command.
</verification>

<success_criteria>
- `apps/main/modules/bootstrap-controller.js` is no longer a mega-controller and is at or below 350 physical lines.
- Focused controller modules exist for event binding, persistence/import/share/hash, render orchestration, visualization bindings, and item-editor lifecycle.
- `syncGroupOptionsFor()` uses a safe DOM-built option path for every group datalist.
- Allocation group directories repeatedly close, open, and close in the full Phase 07 Playwright run after prior Phase 07 tests mutate UI state.
- The full Phase 07 Playwright gate passes after the fixes.
</success_criteria>

<output>
Create `.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-VERIFICATION-GAP-CLOSURE-SUMMARY.md` when done.
</output>
