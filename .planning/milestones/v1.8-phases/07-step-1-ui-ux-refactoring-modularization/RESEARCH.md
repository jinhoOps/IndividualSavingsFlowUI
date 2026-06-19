# Phase 07: Step 1 UI/UX Refactoring & Modularization - Research

**Researched:** 2026-06-16  
**Domain:** Vanilla ES module frontend refactor, CSS consolidation, Step 1 financial UI hardening  
**Confidence:** HIGH for repository findings, MEDIUM for implementation sequencing

## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- Step 2 IndexedDB fallback and private-mode storage behavior — Phase 8.
- Step 2 initial-data warning banner UX — Phase 8.
- Step 2 simulation table mobile redesign — Phase 8.
- Broad React migration for Step 1 — future modernization phase unless separately scoped.
- Replacing the storage/global bridge architecture wholesale — future architecture phase.

## Summary

Phase 07 should be implemented as a conservative Step 1 refactor: keep the existing vanilla ES module runtime and `src/entries/step1.ts` import chain, then reduce `apps/step1/app.js` from its current 1,250-line coordinator shape by extracting event binding, rendering orchestration, persistence/share handlers, item-editor behavior, and visualization tooltip behavior into focused modules under `apps/step1/modules/`. [VERIFIED: codebase grep]

The CSS reduction opportunity is real: `apps/step1/styles.css` is 2,841 lines, while `shared/styles/step-theme.css` already provides tokens, common panels, tabs, buttons, inputs, modals, status indicators, and a 768px responsive baseline. [VERIFIED: codebase grep] The safest path is token consolidation and duplicate removal first, then optional physical CSS splitting only after `src/entries/step1.ts` import order is preserved. [VERIFIED: codebase grep]

The main runtime safety targets are not the SVG renderers that use `textContent` heavily, but the mixed `innerHTML` surfaces in `list-renderer.js`, `app.js`, and `ui-controller.js`, plus imported/merged data paths that feed `sanitizeInputs`. [VERIFIED: codebase grep]

**Primary recommendation:** Refactor Step 1 in three waves: extract `app.js` controller responsibilities, consolidate CSS against `shared/styles/step-theme.css`, then run targeted mobile/escaping verification before broader UI polish. [VERIFIED: codebase grep]

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | DESIGN.md 개편 and editorial style adoption are already listed as milestone UI requirements. [VERIFIED: .planning/REQUIREMENTS.md] | Use Pearl canvas, flat panels, shared colors, Gowun Batang/Dodum, and physical button feedback from `DESIGN.md` and `shared/styles/step-theme.css`. [VERIFIED: DESIGN.md + codebase grep] |
| UI-02 | Cream/Pearl canvas and serif/sans typography are already listed as milestone UI requirements. [VERIFIED: .planning/REQUIREMENTS.md] | Preserve `shared/styles/step-theme.css` as the token source and remove Step 1-only drift from `apps/step1/styles.css`. [VERIFIED: codebase grep] |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Step 1 state ownership | Browser / Client | Local storage bridge | `state.js`, `state-helpers.js`, and `input-sanitizer.js` already own local state normalization and draft/visible input helpers. [VERIFIED: codebase grep] |
| Step 1 rendering | Browser / Client | Shared components | `list-renderer.js`, `sankey-renderer.js`, `network-map-renderer.js`, and `ui-controller.js` mutate DOM directly through the shared `dom.js` registry. [VERIFIED: codebase grep] |
| Step 1 persistence and sharing | Browser / Client | IndexedDB/localStorage bridge | `app.js` calls `window.IsfStorageHub`, `window.IsfShare`, and `window.IsfBackupManager` for save, import, backup, share-code, and restore flows. [VERIFIED: codebase grep] |
| Design tokens and shared UI primitives | Browser / Client CSS | Shared style layer | `src/entries/step1.ts` imports `shared/styles/step-theme.css` before `apps/step1/styles.css`, so Step 1 CSS can override shared tokens but should not duplicate them. [VERIFIED: codebase grep] |
| Mobile acceptance | Browser / Client CSS + Playwright | Manual visual QA | The phase context locks <=768px stability, and current CSS has mobile blocks at 760px, 768px, 520px, and 1080px. [VERIFIED: 07-CONTEXT.md + codebase grep] |

## Standard Stack

### Core
| Library / Asset | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| Browser-native ES modules | current repo pattern | Step 1 app composition | `src/entries/step1.ts` imports legacy globals, shared components, CSS, and `apps/step1/app.js` as side effects. [VERIFIED: codebase grep] |
| Vite | 5.4.21 installed | Dev server and production build | `package.json` exposes `dev`, `build`, and Vite config includes Step 1 as a Rollup input. [VERIFIED: package.json + local CLI] |
| TypeScript checker | 5.9.3 installed | JS/TS static checking via `allowJs` | `npm run check` maps to `tsc --noEmit` and passed in this research session. [VERIFIED: package.json + command output] |
| Playwright | 1.60.0 installed | Step 1 layout and responsive checks | `tests/step1.spec.ts` already checks Step 1 load, Sankey bounds, radius tokens, and Sankey toggle height. [VERIFIED: package.json + local CLI + codebase grep] |
| `shared/styles/step-theme.css` | local asset | Shared tokens and base components | It defines Pearl canvas, panel, typography, spacing, radii, buttons, inputs, modals, pending bar, status, and 768px responsive base styles. [VERIFIED: codebase grep] |

### Supporting
| Library / Asset | Version | Purpose | When to Use |
|-----------------|---------|---------|-------------|
| `shared/core/utils.js` | app version 0.11.72 in file | Formatting, escaping, currency helpers, debouncing | Use `escapeHtml`, `formatMoney`, `convertToKoreanWon`, `toWon`, `toMan`, and `debounce` before adding Step 1 helpers. [VERIFIED: codebase grep] |
| `input-sanitizer.js` | local module | Runtime input normalization | Use at every external/import/merge/restore boundary before data reaches state, storage, or renderers. [VERIFIED: codebase grep] |
| `dom.js` | local module | DOM registry | Use as the shared selector boundary for extracted controllers to avoid scattered `querySelector` calls. [VERIFIED: codebase grep] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vanilla ES module extraction | React migration | Out of scope because Phase 07 explicitly avoids broad Step 1 React migration. [VERIFIED: 07-CONTEXT.md] |
| Current pure SVG Sankey/network renderers | New charting dependency | Out of scope because Phase 07 explicitly says not to introduce a new charting dependency. [VERIFIED: 07-CONTEXT.md] |
| Immediate CSS file splitting | Token consolidation first | CSS splitting can help later, but the current entry imports only `step-theme.css` and `styles.css`, and duplicate/dead CSS removal is the higher-confidence first reduction. [VERIFIED: codebase grep] |

**Installation:** No new install is recommended for this phase. [VERIFIED: 07-CONTEXT.md]

## Package Legitimacy Audit

No external package installation is recommended for Phase 07, so the package legitimacy gate is not applicable. [VERIFIED: 07-CONTEXT.md + package.json]

**Packages removed due to [SLOP] verdict:** none. [VERIFIED: no new packages recommended]  
**Packages flagged as suspicious [SUS]:** none. [VERIFIED: no new packages recommended]

## Existing Step 1 Architecture

| File | Current Responsibility | Refactor Implication |
|------|------------------------|----------------------|
| `apps/step1/app.js` | 1,250-line coordinator containing init, event binding, modal/share handlers, item editing, persistence, global events, render orchestration, and pending state. [VERIFIED: codebase grep] | Make it a thin bootstrap and orchestration shell; do not move calculator/state/render logic back into it. [VERIFIED: codebase grep] |
| `apps/step1/modules/state.js` | Initializes sanitized input state, backup flags, Sankey options, item editors, and projection options. [VERIFIED: codebase grep] | Keep as primary state owner. [VERIFIED: 07-CONTEXT.md] |
| `apps/step1/modules/state-helpers.js` | Handles clone/reset, visible inputs, derived sync, form read/apply helpers, and item-editor signatures. [VERIFIED: codebase grep] | Reuse from new controllers instead of duplicating form/state conversion. [VERIFIED: codebase grep] |
| `apps/step1/modules/ui-controller.js` | Syncs UI state such as backup list, Sankey controls, mobile collapse state, advanced tabs, form values, and group option lists. [VERIFIED: codebase grep] | Move more DOM synchronization here only when it remains passive and state-driven. [VERIFIED: 07-CONTEXT.md] |
| `apps/step1/modules/list-renderer.js` | Renders summary cards, projection rows, item rows, account rows, transfer boards, and select options, mostly via `innerHTML`. [VERIFIED: codebase grep] | Primary XSS/hardening target; keep output escaping consistent and consider DOM construction for risky user strings. [VERIFIED: codebase grep] |
| `apps/step1/modules/sankey-renderer.js` | Renders SVG Sankey, legend, collapsed detail panel, tooltip text, and PNG/SVG export. [VERIFIED: codebase grep] | Keep as renderer; avoid changing data contracts except to reduce redundant redraw triggers. [VERIFIED: codebase grep] |
| `apps/step1/modules/network-map-renderer.js` | Clears container and builds SVG network map with text nodes and event listeners. [VERIFIED: codebase grep] | Keep text insertion via `textContent`; validate unit assumptions around `value * 10000`. [VERIFIED: codebase grep] |
| `apps/step1/modules/input-sanitizer.js` | Migrates modelVersion <10 data to Won, clamps amounts/rates, normalizes names/groups/accounts/transfers, and caps item counts. [VERIFIED: codebase grep] | Use as the first guard at imported JSON, share-code, restore, hash, and merge paths. [VERIFIED: codebase grep] |

## Recommended Module Extraction

| New / Existing Module | Move From `app.js` | Notes |
|-----------------------|--------------------|-------|
| `modules/bootstrap-controller.js` | `init`, returning-user check, onboarding start, PWA manager setup, backup-store initialization, share-id initialization. [VERIFIED: codebase grep] | Keep `app.js` as `init()` plus imports and module wiring only. [VERIFIED: codebase grep] |
| `modules/event-bindings.js` | `bindControls`, `bindActionButtons`, `bindGlobalEvents`, readonly navigation, management tabs. [VERIFIED: codebase grep] | Pass a small command object for callbacks to avoid circular imports. [ASSUMED] |
| `modules/visualization-controller.js` | `bindVisualizationAndTooltipEvents`, Sankey tab switching, transfer-rule form events, global tooltip formatting, accordion toggle. [VERIFIED: codebase grep] | Separate tooltip HTML formatting into a tiny pure helper so escaping can be tested or grep-audited. [VERIFIED: codebase grep] |
| `modules/render-orchestrator.js` | `renderAll`, projection mode setter, Sankey value/sort/group/detail setters. [VERIFIED: codebase grep] | Preserve `buildMonthlySnapshot -> simulateProjection -> buildSummaryCards -> renderers` order. [VERIFIED: codebase grep] |
| `modules/persistence-controller.js` | `commitImmediateInputs`, `persistPrimaryState`, manual backup, restore, JSON import/export, view-save, sample/reset, hash-change, ISF CODE apply/merge/generate. [VERIFIED: codebase grep] | Every inbound data path should call `sanitizeInputs` before commit. [VERIFIED: codebase grep] |
| `modules/item-editor-controller.js` | `bindItemEditorEvents`, item input/click handling, editor start/apply/cancel/add, mobile editor FAB sync. [VERIFIED: codebase grep] | Keep validation for income allocation total <= income amount in this module. [VERIFIED: codebase grep] |

**Dependency rule:** New controllers should import `dom`, `state`, helpers, renderers, and `IsfUtils`; they should not import each other except through explicit callbacks from `app.js` or a small coordinator object. [ASSUMED]

## CSS Reduction Strategy

### High-Confidence Reduction Targets
| Target | Evidence | Action |
|--------|----------|--------|
| Duplicate account/management blocks | Selectors such as `.account-list`, `.account-row`, `.account-name`, `.income-row:not(.is-editing)`, `.badge-account`, `.mgmt-tabs`, `.mgmt-tab`, and `.mgmt-panel` appear twice between roughly lines 1673-2041, and `.account-row` appears again near 2638. [VERIFIED: codebase grep] | Remove the older or weaker duplicate after visual comparison; keep one canonical block near related account/management styles. [VERIFIED: codebase grep] |
| Duplicate status warning styles | `.account-row--warn`, `.account-row--crit`, `.status-badge--warn`, and `.status-badge--crit` appear around 2336-2364 and again around 2642-2658. [VERIFIED: codebase grep] | Keep the Phase 4 spec-compatible values unless DESIGN.md updates supersede them. [VERIFIED: 04-CONTEXT.md] |
| Duplicated export button styles | `.sankey-export-btn`, hover, and SVG child styles appear around 1703-1715 and again around 1898-1910. [VERIFIED: codebase grep] | Collapse to one block. [VERIFIED: codebase grep] |
| Inline styles in Step 1 HTML | `apps/step1/index.html` has inline styles in section heads, transfer editor, Sankey title group, network map, projection options, comparison controls, and preset modal. [VERIFIED: codebase grep] | Move durable layout declarations into Step 1 component CSS; leave only truly dynamic styles in JS. [VERIFIED: codebase grep] |
| Design-token drift | `apps/step1/styles.css` uses `--panel-sub` and `--text-muted`, while `shared/styles/step-theme.css` defines `--panel`, `--muted`, `--line`, and status tokens. [VERIFIED: codebase grep] | Replace undefined or drifted tokens with shared tokens or add explicit shared tokens only if multiple steps need them. [VERIFIED: codebase grep] |
| Decorative background drift | `apps/step1/styles.css` defines radial/linear ambient gradients, while `DESIGN.md` says Pearl canvas and flat editorial panels should be the base. [VERIFIED: DESIGN.md + codebase grep] | Remove or flatten `.ambient` unless the redesign intentionally keeps a very subtle canvas treatment. [VERIFIED: DESIGN.md] |
| Excessive `!important` mobile overrides | Mobile blocks around 529, 2071, and 2824 contain many `!important` declarations. [VERIFIED: codebase grep] | Consolidate cascade order and selector specificity before deleting; run mobile checks after each block removal. [VERIFIED: codebase grep] |

### Responsive-Risk Areas
| Area | Why Risky | Verification |
|------|-----------|--------------|
| Mobile controls/editor rows | The first 760px block rewrites item editor grids, income allocation rows, account row editing, action menus, Sankey controls, and projection table width with many `!important` rules. [VERIFIED: codebase grep] | Playwright at 390x844 and 768x1024 with editor mode, Sankey controls, and projection expanded. [VERIFIED: codebase grep] |
| Sankey/network visualization | CSS fixes `.sankey-wrap` height to 380px on small screens, while render code calculates SVG dimensions from container width and state zoom. [VERIFIED: codebase grep] | Check no clipping/blank SVG after tab switches, zoom buttons, resize, and orientation change. [VERIFIED: codebase grep] |
| Management tabs and advanced tabs | A 768px block turns `.mgmt-tabs` and `.advanced-block > .tab-list` into horizontal scroll tabs. [VERIFIED: codebase grep] | Check horizontal scroll does not hide active tabs or cause body overflow. [VERIFIED: codebase grep] |
| Projection options and table | Projection options have inline flex styles and CSS switches to column at 760px; projection table remains min-width 780px. [VERIFIED: codebase grep] | Verify `.table-wrap` scroll containment and no overlap with panel toggle. [VERIFIED: codebase grep] |
| Comparison panel | Panel sequence includes Comparison, but current index has an overlay indicating the feature is not ready. [VERIFIED: codebase grep] | Preserve panel presence and overlay semantics; do not implement deferred comparison logic. [VERIFIED: 07-CONTEXT.md] |

## UI/UX Recomposition Approach

1. Keep HTML panel order as Summary, Controls, Visualization, Projection, Comparison unless the implementation also corrects CSS `order` to match the locked Summary, Visualization, Controls, Projection, Comparison sequence. [VERIFIED: index.html + 07-CONTEXT.md]
2. Use CSS ordering or DOM movement intentionally; current CSS gives `.controls-panel` order 2 and `.sankey-panel` order 3, which conflicts with the Phase 07 locked baseline sequence. [VERIFIED: codebase grep]
3. Recompose panels as flat editorial work surfaces: shared `.panel`, solid borders, Pearl canvas, no card nesting, no gradient/glass card backgrounds, and <=8px controls unless tokenized otherwise. [VERIFIED: DESIGN.md + shared/styles/step-theme.css]
4. Move lower-priority dense controls behind existing collapsible affordances on mobile, but keep preset, income/accounts, visualization tabs, and save/data hub reachable without horizontal body overflow. [VERIFIED: 07-CONTEXT.md + codebase grep]
5. Preserve Phase 3/4 visualization decisions: Sankey remains the 3-stage household flow view, while account-to-account transfers remain in a separate board/network map rather than being reinserted into Sankey links. [VERIFIED: 03-CONTEXT.md + 04-CONTEXT.md]

## Rendering Safety And Runtime Guards

| Surface | Current Evidence | Guard Target |
|---------|------------------|--------------|
| `list-renderer.js` summary cards | `renderCards` writes `card.label`, `card.value`, and `card.sub` through `innerHTML`. [VERIFIED: codebase grep] | If any card text can include imported/user data later, switch to `createElement` + `textContent` or escape each field. [VERIFIED: codebase grep] |
| `list-renderer.js` tables and lists | Projection rows and item/account/transfer rows use string templates and `innerHTML`; many names are escaped with `IsfUtils.escapeHtml`. [VERIFIED: codebase grep] | Keep escaped name/account/label fields; audit unescaped dynamic ids in attributes such as `value="${acc.id}"`, `data-editor-id`, and `data-delete-transfer-id`. [VERIFIED: codebase grep] |
| `ui-controller.js` datalist | `syncGroupOptionsFor` writes `names.map(n => <option value="${n}">)` without `escapeHtml`. [VERIFIED: codebase grep] | Escape group names or build options via `document.createElement("option")`. [VERIFIED: codebase grep] |
| `app.js` preset options | Preset salary options are written through `innerHTML` from local constants. [VERIFIED: codebase grep] | Low risk if constants remain trusted; still prefer DOM option construction during extraction. [VERIFIED: codebase grep] |
| `app.js` global tooltip | Tooltip text is escaped for `&`, `<`, and `>` before markdown-like HTML substitutions, then assigned to `innerHTML`. [VERIFIED: codebase grep] | Also escape quotes if attributes are introduced later; keep tooltip source restricted to trusted `data-tooltip` values or sanitize before formatting. [VERIFIED: codebase grep] |
| `app.js` import/apply/merge/hash/restore | `handleApplyIsfCode`, `handleMergeIsfCode`, `handleImportJson`, `handleHashChange`, and `restoreBackupById` reach `commitImmediateInputs`, which sanitizes inputs. [VERIFIED: codebase grep] | Add a tiny `normalizeExternalStep1Inputs(source, raw)` wrapper so every external path is explicit and testable. [ASSUMED] |
| `input-sanitizer.js` transfer/account IDs | Account and transfer ids are trimmed strings and transfer endpoints must exist in `accounts`. [VERIFIED: codebase grep] | Consider slicing ids/labels to a bounded length before they enter attribute values. [ASSUMED] |
| `IsfUtils.toWon` / `toMan` | Both functions currently return rounded numeric input without multiplying or dividing by 10,000. [VERIFIED: codebase grep] | Clarify naming/comments and UI labels because DESIGN.md says UI displays 만원 while storage keeps 원, but current Step 1 labels and helpers behave as Won pass-throughs. [VERIFIED: DESIGN.md + codebase grep] |

## Architecture Patterns

### System Architecture Diagram

```text
User input / import / ISF CODE / backup restore
  -> input-sanitizer.js normalize + migrate-to-Won
  -> state.js current inputs / draft state
  -> render-orchestrator.js
     -> calculator.js monthly snapshot + projection
     -> sankey-builder.js Sankey data
     -> list-renderer.js cards, rows, tables, transfer UI
     -> sankey-renderer.js SVG Sankey
     -> network-map-renderer.js SVG account map
     -> ui-controller.js form/control synchronization
  -> persistence-controller.js local save + backup/share bridge
```

### Recommended Project Structure

```text
apps/step1/modules/
├── bootstrap-controller.js        # startup, PWA, onboarding, initial backup/share loading
├── event-bindings.js              # top-level DOM event registration
├── visualization-controller.js    # Sankey/network tabs, tooltip formatting, transfer UI events
├── render-orchestrator.js         # renderAll and render-related setters
├── persistence-controller.js      # save, backup, import/export, ISF CODE, hash/share restore
├── item-editor-controller.js      # item editor lifecycle and validation
├── ui-controller.js               # existing passive DOM sync helpers
└── list-renderer.js               # existing HTML/list renderer, hardened as needed
```

### Pattern 1: Thin Bootstrap
**What:** `app.js` should import modules, call `init`, and pass dependencies/callbacks; it should not own all behavior directly. [VERIFIED: codebase grep]  
**When to use:** Use for Phase 07 because the file currently combines independent responsibilities. [VERIFIED: codebase grep]

```javascript
// Source: apps/step1/app.js + proposed local extraction pattern
import { createRenderOrchestrator } from "./modules/render-orchestrator.js";
import { bindStep1Events } from "./modules/event-bindings.js";

const render = createRenderOrchestrator({ state, dom, buildMonthlySnapshot });
bindStep1Events({ state, dom, renderAll: render.renderAll });
render.renderAll();
```

### Pattern 2: Safe Option Construction
**What:** Build `<option>` nodes with DOM APIs when values can originate from user/imported state. [VERIFIED: codebase grep]  
**When to use:** Use for account selects, group datalists, and transfer selects. [VERIFIED: codebase grep]

```javascript
// Source: shared/core/utils.js escapeHtml exists; safer DOM API preferred for option values
const option = document.createElement("option");
option.value = account.id;
option.textContent = account.name;
select.appendChild(option);
```

### Anti-Patterns to Avoid
- **React rewrite:** Contradicts Phase 07 scope and increases compatibility risk. [VERIFIED: 07-CONTEXT.md]
- **CSS truncation by broad deletion:** Mobile media-query integrity is a locked risk area. [VERIFIED: 07-CONTEXT.md]
- **New charting dependency:** Contradicts D-16 and is unnecessary for the existing pure SVG renderers. [VERIFIED: 07-CONTEXT.md + codebase grep]
- **Unit conversion by intuition:** `toWon` and `toMan` are currently 1:1 numeric rounders, so multiplying/dividing in new code would cause conversion drift. [VERIFIED: codebase grep]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML escaping | New escaping regex in Step 1 modules | `IsfUtils.escapeHtml` or DOM `textContent` | Shared utility already escapes core HTML entities. [VERIFIED: codebase grep] |
| Debounced resize | New debounce utility | `IsfUtils.debounce` | Existing global utility is already used for Sankey resize. [VERIFIED: codebase grep] |
| Input normalization | New schema system by default | `sanitizeInputs` plus focused wrappers | Existing sanitizer already migrates model versions, clamps money/rates, normalizes names/accounts/transfers, and caps item counts. [VERIFIED: codebase grep] |
| Shared buttons/panels/tokens | New Step 1-only visual primitives | `shared/styles/step-theme.css` tokens and components | Shared theme already defines common UI primitives imported before Step 1 CSS. [VERIFIED: codebase grep] |
| Chart rendering | New chart/network library | Existing `sankey-renderer.js` and `network-map-renderer.js` | Phase scope forbids a new charting dependency. [VERIFIED: 07-CONTEXT.md] |

**Key insight:** The phase is not missing primitives; it has too many local overrides around existing primitives. [VERIFIED: codebase grep]

## Common Pitfalls

### Pitfall 1: Panel Sequence Drift
**What goes wrong:** The locked sequence says Summary, Visualization, Controls, Projection, Comparison, but current CSS orders Controls before Sankey/Visualization. [VERIFIED: 07-CONTEXT.md + codebase grep]  
**Why it happens:** CSS `order` can preserve an older flow even if the redesign updates visual hierarchy. [VERIFIED: codebase grep]  
**How to avoid:** Decide whether to reorder DOM or CSS, then verify visual order at desktop and <=768px. [VERIFIED: codebase grep]  
**Warning signs:** `.controls-panel { order: 2; }` and `.sankey-panel { order: 3; }` remain after the redesign. [VERIFIED: codebase grep]

### Pitfall 2: CSS Duplicate Removal Breaks Mobile Fixes
**What goes wrong:** Removing repeated selectors can delete later overrides that currently repair mobile rows/tabs. [VERIFIED: codebase grep]  
**Why it happens:** The stylesheet has duplicate blocks plus late mobile overrides at 760px and 768px. [VERIFIED: codebase grep]  
**How to avoid:** Collapse duplicates one group at a time and run grep line-count plus mobile Playwright checks after each group. [VERIFIED: codebase grep]  
**Warning signs:** Body horizontal scroll, clipped Sankey controls, missing management tabs, or hidden editor buttons at 390px width. [ASSUMED]

### Pitfall 3: Attribute Injection Through Escaped Text Assumption
**What goes wrong:** Text escaping is often applied for element content but not for attribute values such as `value`, `data-*`, or ids. [VERIFIED: codebase grep]  
**Why it happens:** Current renderers mix template strings and escaped content. [VERIFIED: codebase grep]  
**How to avoid:** Build risky form/select options with DOM APIs or escape every interpolated value, not just visible labels. [VERIFIED: codebase grep]  
**Warning signs:** New `innerHTML` templates include imported names, ids, labels, or groups without `escapeHtml`. [VERIFIED: codebase grep]

### Pitfall 4: Accidental Unit Conversion Change
**What goes wrong:** New UI code may assume `toWon` multiplies by 10,000 or `toMan` divides by 10,000. [VERIFIED: codebase grep]  
**Why it happens:** DESIGN.md states UI displays 만원 while storage keeps 원, but current Step 1 helpers are 1:1 numeric rounders. [VERIFIED: DESIGN.md + codebase grep]  
**How to avoid:** Clarify helper comments and labels before touching form read/apply code. [VERIFIED: codebase grep]  
**Warning signs:** Existing amounts suddenly become 10,000x too large or too small after refactor. [ASSUMED]

## Code Examples

### External Data Guard Wrapper

```javascript
// Source: apps/step1/app.js currently repeats sanitizeInputs at multiple boundaries
function normalizeExternalStep1Inputs(raw, fallback = DEFAULT_INPUTS) {
  return sanitizeInputs({ ...fallback, ...(raw || {}) });
}
```

### Renderer-Safe Select Options

```javascript
// Source: list-renderer.js currently uses innerHTML for select options
function replaceOptions(select, accounts) {
  select.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "계좌 선택...";
  select.appendChild(empty);

  accounts.forEach((account) => {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = account.name;
    select.appendChild(option);
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single giant Step 1 controller | Existing repo already has state/helper/renderer modules, but `app.js` still owns too many bindings and orchestration paths. [VERIFIED: codebase grep] | Before Phase 07. [VERIFIED: codebase grep] | Phase 07 should finish modularization rather than introduce a new architecture. [VERIFIED: 07-CONTEXT.md] |
| Step-local visual styling | Shared `step-theme.css` is already imported before Step 1 CSS. [VERIFIED: codebase grep] | Before Phase 07. [VERIFIED: codebase grep] | Phase 07 should delete drift and duplicates before adding new Step 1 CSS. [VERIFIED: codebase grep] |
| Sankey as all-flow renderer | Sankey is limited to household flow; transfer/network map represents N:N account movement. [VERIFIED: 03-CONTEXT.md + 04-CONTEXT.md] | Phase 03/04. [VERIFIED: prior contexts] | Do not reinsert account transfers into Sankey. [VERIFIED: prior contexts] |

**Deprecated/outdated:**
- Broad marketing-style visual composition is out of scope; Step 1 remains an operational financial input surface. [VERIFIED: 07-CONTEXT.md]
- Broad Step 1 React migration is deferred. [VERIFIED: 07-CONTEXT.md]
- Step 2 storage/table/mobile findings are deferred to Phase 8. [VERIFIED: 07-CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | New controllers should communicate via explicit callbacks to avoid circular imports. [ASSUMED] | Recommended Module Extraction | Planner may choose a different dependency-injection style; implementation still needs acyclic imports. |
| A2 | Body horizontal scroll and clipped editor controls are likely warning signs after CSS removal. [ASSUMED] | Common Pitfalls | Verification could miss visual regressions if it checks only existing Playwright assertions. |
| A3 | A tiny external-data wrapper is enough and a full schema library is unnecessary. [ASSUMED] | Rendering Safety | If imported data has deeper shape drift, planner may need more guard coverage inside `input-sanitizer.js`. |

## Open Questions — RESOLVED

All Phase 07 research questions are resolved for execution.

1. **RESOLVED: Phase 07 should correct the visual panel order by preferring DOM order.**
   - What we know: Context locks Summary, Visualization, Controls, Projection, Comparison, while current CSS orders Controls before Sankey/Visualization. [VERIFIED: 07-CONTEXT.md + codebase grep]  
   - Resolution: Prefer DOM order if existing `dom.js` selectors and controller bindings can be preserved. If DOM movement would break selectors or create disproportionate regression risk, CSS order is acceptable only when the implementation explicitly documents that choice and verifies keyboard/tab flow in addition to visual order. [VERIFIED: 07-CONTEXT.md + checker revision]

2. **RESOLVED: `toWon` / `toMan` should be documented, not renamed or behavior-changed, in Phase 07.**
   - What we know: Both functions are currently 1:1 numeric rounders. [VERIFIED: codebase grep]  
   - Resolution: Phase 07 must document the current 1:1 numeric rounder behavior and preserve conversion behavior. Do not rename these helpers, do not introduce multiply/divide-by-10,000 behavior, and do not change stored/display units in this phase. [VERIFIED: codebase grep + checker revision]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vite, TypeScript, Playwright | yes | 24.15.0 | none needed. [VERIFIED: local CLI] |
| npm | Scripts | yes | 11.10.0 | none needed. [VERIFIED: local CLI] |
| Vite | Dev/build | yes | 5.4.21 | none needed. [VERIFIED: local CLI] |
| TypeScript | `npm run check` | yes | 5.9.3 | none needed. [VERIFIED: local CLI] |
| Playwright | `npm run test:e2e` | yes | 1.60.0 | Manual browser checks if browser binaries fail. [VERIFIED: local CLI] |

**Missing dependencies with no fallback:** none found. [VERIFIED: local CLI]  
**Missing dependencies with fallback:** Playwright browser runtime can fall back to manual mobile screenshots only if browser launch fails. [ASSUMED]

## Validation Architecture

Skipped because `.planning/config.json` sets `workflow.nyquist_validation` to `false`. [VERIFIED: .planning/config.json]

## Practical Verification Commands

```powershell
# Static check
npm run check

# Existing Step 1 e2e checks
npm run test:e2e -- tests/step1.spec.ts

# Build check; note this runs version-sync/bump scripts in this repo
npm run build

# Current size baselines
(Get-Content apps\step1\app.js).Count
(Get-Content apps\step1\styles.css).Count

# Duplicate selector candidates
$css=Get-Content apps\step1\styles.css; $selectors=@{}; for($i=0;$i -lt $css.Count;$i++){ $line=$css[$i].Trim(); if($line -match '^(\.[\w-]+|#[\w-]+|[a-zA-Z][\w-]*|body\.[\w-]+|\\.[\w-]+[\s:>\.#])' -and $line.EndsWith('{')){ $sel=$line.TrimEnd('{').Trim(); if(!$selectors.ContainsKey($sel)){ $selectors[$sel]=@() }; $selectors[$sel]+=$i+1 } }; $selectors.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 } | Sort-Object Name

# Rendering safety grep
rg -n "innerHTML|insertAdjacentHTML|outerHTML|escapeHtml|sanitizeInputs|toWon|toMan" apps/step1 shared/core/utils.js

# Responsive integrity grep
rg -n "@media \(max-width: (760|768|520|1080)px\)|sankey-wrap|mgmt-tabs|advanced-block|projection-table|action-menu|income-row|account-row" apps/step1/styles.css

# Inline style migration candidates
rg -n "style=" apps/step1/index.html
```

**Current verified baselines:** `apps/step1/app.js` has 1,250 lines and `apps/step1/styles.css` has 2,841 lines. [VERIFIED: codebase grep]  
**Current check result:** `npm run check` passed during research. [VERIFIED: command output]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Static/local app has no authentication flow in Step 1. [VERIFIED: codebase grep] |
| V3 Session Management | no | Step 1 uses local/share state rather than authenticated sessions. [VERIFIED: codebase grep] |
| V4 Access Control | no | No role or permission boundary is present in Step 1. [VERIFIED: codebase grep] |
| V5 Input Validation | yes | Use `sanitizeInputs`, specific normalizers, `IsfUtils.escapeHtml`, and DOM `textContent`/option creation. [VERIFIED: codebase grep] |
| V6 Cryptography | no | Phase 07 does not add cryptographic behavior. [VERIFIED: 07-CONTEXT.md] |

### Known Threat Patterns for Step 1

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored/reflected XSS through imported JSON, ISF CODE, or merged partner data | Tampering / Information Disclosure | Sanitize external inputs before commit and escape or DOM-build all renderer output. [VERIFIED: codebase grep] |
| Attribute injection through ids/names in template strings | Tampering | Escape attribute values or use DOM APIs for form controls and options. [VERIFIED: codebase grep] |
| Local-storage data shape drift | Denial of Service | Keep `sanitizeInputs` at load/restore/hash/import boundaries and preserve modelVersion migration. [VERIFIED: codebase grep] |
| Unit confusion causing financial misstatement | Tampering | Clarify `toWon`/`toMan` semantics and test representative amounts. [VERIFIED: DESIGN.md + codebase grep] |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/07-step-1-ui-ux-refactoring-modularization/07-CONTEXT.md` - locked scope, decisions, deferred items, and source targets. [VERIFIED: local file read]
- `DESIGN.md` - visual system, typography, panel, responsive, and unit guidance. [VERIFIED: local file read]
- `apps/step1/app.js` - current controller responsibilities and runtime paths. [VERIFIED: codebase grep]
- `apps/step1/styles.css` - CSS size, duplicate selector candidates, media-query risks, and UI overrides. [VERIFIED: codebase grep]
- `shared/styles/step-theme.css` - shared tokens and base component styles. [VERIFIED: local file read]
- `apps/step1/modules/*.js` and `shared/core/utils.js` - module boundaries, sanitization, renderers, and utility semantics. [VERIFIED: codebase grep]
- `.planning/phases/03-multi-account-data-model/03-CONTEXT.md` and `.planning/phases/04-account-transfer-ui-ux-polish/04-CONTEXT.md` - Sankey/network/transfer decisions to preserve. [VERIFIED: local file read]

### Secondary (MEDIUM confidence)
- `package.json`, `playwright.config.ts`, `tests/step1.spec.ts`, `tsconfig.json`, `vite.config.ts` - repository validation scripts and existing test coverage. [VERIFIED: local file read]

### Tertiary (LOW confidence)
- GSD `classify-confidence --provider codebase --verified` returned LOW, so this document uses explicit local-file provenance tags rather than treating the seam confidence as authoritative. [VERIFIED: gsd-tools output]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing repo scripts, entry imports, and CLI versions were read or executed locally. [VERIFIED: package.json + local CLI]
- Architecture: HIGH - module boundaries and responsibilities were verified from source files. [VERIFIED: codebase grep]
- CSS risks: HIGH - duplicate selectors, media queries, inline styles, and token drift were verified by grep. [VERIFIED: codebase grep]
- Security/runtime guard recommendations: MEDIUM - hotspots are verified, while exact hardening implementation should be confirmed during planning. [VERIFIED: codebase grep]

**Research date:** 2026-06-16  
**Valid until:** 2026-07-16, assuming Step 1 source structure does not change before planning. [ASSUMED]
