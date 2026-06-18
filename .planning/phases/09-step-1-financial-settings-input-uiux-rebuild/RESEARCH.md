# Phase 09: Step 1 Financial Settings Input UIUX Rebuild - Research

**Researched:** 2026-06-18  
**Domain:** Browser-local vanilla ES module financial settings UI, account normalization, and custom SVG Sankey data flow. [VERIFIED: .planning/phases/09-step-1-financial-settings-input-uiux-rebuild/09-CONTEXT.md]  
**Confidence:** HIGH for repository structure and locked scope; MEDIUM for recommended heuristics where Phase 09 leaves exact rules to planner discretion. [VERIFIED: local file reads] [ASSUMED]

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- Detailed bank-account modeling with bank name, account type, and live balance.
- Live banking or transaction import.
- Broad React rewrite of Step 1.
- Separate standalone account-management product surface.
</user_constraints>

## Summary

Step 1 is already in the Phase 07 vanilla ES module shape: `apps/main/app.js` only imports `startStep1App()`, `bootstrap-controller.js` is 157 lines, and responsibilities are split across event bindings, persistence, render orchestration, item editing, UI sync, list rendering, sanitizer, and visualization modules. [VERIFIED: apps/main/app.js] [VERIFIED: apps/main/modules/bootstrap-controller.js] [VERIFIED: codebase grep] The Phase 09 plan should not re-open broad orchestration refactors; it should replace the dense tab/list editing surface with summary cards plus modal-based detail and creation flows. [VERIFIED: 09-CONTEXT.md] [ASSUMED]

The safest implementation seam is a Step 1 card/detail layer that reuses current state and sanitizer contracts rather than storing a second model. [VERIFIED: apps/main/modules/state.js] [VERIFIED: apps/main/modules/input-sanitizer.js] The current `list-renderer.js` already renders account badges, grouped allocation lists, creator panels, and clickable rows, but it does so through inline list editing and `innerHTML`; Phase 09 should move guided creation/detail flows into controller-owned modal state and keep list/card renderers summary-oriented. [VERIFIED: apps/main/modules/list-renderer.js] [VERIFIED: apps/main/modules/item-editor-controller.js]

The highest-risk data change is Sankey, because current `buildSankeyData()` routes individual income nodes directly to accounts, then accounts to outflows; Phase 09 must insert a mandatory `총수입` aggregate node before account distribution. [VERIFIED: apps/main/modules/sankey-builder.js] Account repair should happen before rendering, preferably through a deterministic normalization/correction helper that is called from `sanitizeInputs()` and external input guard paths, because Step 1 data can arrive from localStorage, backups, imports, share codes, and hash/share-id restore. [VERIFIED: apps/main/modules/input-sanitizer.js] [VERIFIED: apps/main/modules/persistence-controller.js] [VERIFIED: apps/main/modules/storage-manager.js]

**Primary recommendation:** Implement Phase 09 as three narrow slices: Step 1 summary/modal UI, preset generation/confirmation, and account/Sankey correction, all staying inside `apps/main/modules/` with no new package installs. [VERIFIED: 09-CONTEXT.md] [VERIFIED: package.json] [ASSUMED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Step 1 summary cards and category groups | Browser / Client | CSS/shared theme | Step 1 is a static browser app under `apps/main` and uses DOM modules plus `shared/styles/step-theme.css`. [VERIFIED: apps/main/index.html] [VERIFIED: shared/styles/step-theme.css] |
| Detail/edit modal and guided creation modal | Browser / Client | Local state helpers | Existing Step 1 edits are client-only and write through `state.inputs`, `item-editor-controller.js`, and `persistence-controller.js`. [VERIFIED: apps/main/modules/state.js] [VERIFIED: apps/main/modules/item-editor-controller.js] [VERIFIED: apps/main/modules/persistence-controller.js] |
| Preset quick setup | Browser / Client | Calculator/sanitizer helpers | Current preset generation is local JS in `presets.js` and commits through normalized persistence. [VERIFIED: apps/main/modules/presets.js] [VERIFIED: apps/main/modules/event-bindings.js] |
| Account correction/migration | Browser / Client | Browser storage | Existing data enters through localStorage, backup, JSON import, ISF CODE, hash, and share-id paths before `sanitizeInputs()`. [VERIFIED: apps/main/modules/storage-manager.js] [VERIFIED: apps/main/modules/persistence-controller.js] |
| Sankey canonical data flow | Browser / Client | SVG renderer | `buildSankeyData()` creates node/link topology and `sankey-renderer.js` lays it out; topology belongs in the builder, not SVG drawing. [VERIFIED: apps/main/modules/sankey-builder.js] [VERIFIED: apps/main/modules/sankey-renderer.js] |
| Verification | Browser / Client test runner | Playwright web server | Existing E2E uses Playwright with Vite webServer and `tests/step1.spec.ts`. [VERIFIED: playwright.config.ts] [VERIFIED: tests/step1.spec.ts] |

## Standard Stack

### Core
| Library / Asset | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| Vanilla ES modules in `apps/main/modules` | local project pattern | Step 1 state, render, controller, sanitizer, visualization modules | Phase 07 established Step 1 as vanilla ES modules and Phase 09 explicitly forbids a broad React rewrite. [VERIFIED: 07-CONTEXT.md] [VERIFIED: 09-CONTEXT.md] |
| Vite | package `^5.3.1`; CLI resolved `5.4.21` | Local dev server and build entry pipeline | Playwright config already starts Vite for browser tests. [VERIFIED: package.json] [VERIFIED: local CLI] [VERIFIED: playwright.config.ts] |
| Playwright | package `^1.60.0`; CLI `1.60.0` | Step 1 E2E, responsive, and SVG verification | Existing Step 1 tests use Playwright and already cover mobile, Sankey, rendering safety, and module contracts. [VERIFIED: package.json] [VERIFIED: local CLI] [VERIFIED: tests/step1.spec.ts] |
| Shared ISF theme | local CSS | Pearl canvas, panels, buttons, inputs, modal shell, responsive baseline | DESIGN.md and Phase 09 require shared card/modal/button tokens and Step 3-like visual consistency. [VERIFIED: DESIGN.md] [VERIFIED: shared/styles/step-theme.css] [VERIFIED: 09-CONTEXT.md] |

### Supporting
| Library / Module | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| `shared/core/utils.js` / `IsfUtils` | local project utility | Won formatting, Korean Won hints, sanitization helpers, escaping | Use before adding new money/escaping utilities. [VERIFIED: 07-CONTEXT.md] [VERIFIED: apps/main/modules/list-renderer.js] |
| `apps/main/modules/input-sanitizer.js` | local module | Model migration, amount/rate clamp, account/item normalization | Extend for deterministic account-link repair and correction metadata. [VERIFIED: apps/main/modules/input-sanitizer.js] [ASSUMED] |
| `apps/main/modules/presets.js` | local module | Current salary/style preset generation | Refactor into percentage preset generation and confirmation payload builder. [VERIFIED: apps/main/modules/presets.js] [ASSUMED] |
| `apps/portfolio/modules/*` | local Step 3 reference | Creator state, card click, detail modal, confirmation modal, ratios | Adapt interaction pattern, not storage model. [VERIFIED: apps/portfolio/app.js] [VERIFIED: apps/portfolio/modules/dom.js] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Step 1 vanilla modal modules | React component migration | Out of scope because Phase 09 defers broad React rewrite. [VERIFIED: 09-CONTEXT.md] |
| Custom Sankey topology in renderer | Patch labels/links while drawing SVG | Wrong layer because `buildSankeyData()` owns nodes/links and `renderSankey()` consumes topology. [VERIFIED: apps/main/modules/sankey-builder.js] [VERIFIED: apps/main/modules/sankey-renderer.js] |
| Standalone account manager page | Inline account creation/selection inside item modals | Standalone account-management surface is explicitly rejected for this phase. [VERIFIED: 09-CONTEXT.md] |

**Installation:** No new packages should be installed for this phase. [VERIFIED: package.json] [VERIFIED: 09-CONTEXT.md]

## Package Legitimacy Audit

No external package installation is recommended, so the Package Legitimacy Gate is not applicable. [VERIFIED: package.json]  
**Packages removed due to [SLOP] verdict:** none. [VERIFIED: package.json]  
**Packages flagged as suspicious [SUS]:** none. [VERIFIED: package.json]

## Architecture Patterns

### System Architecture Diagram

```text
User opens Step 1
  -> apps/main/index.html static DOM
  -> src/entries/step1.ts imports shared theme + app bootstrap [VERIFIED: apps/main/index.html]
  -> bootstrap-controller.js wires controllers [VERIFIED: apps/main/modules/bootstrap-controller.js]
  -> state.js loads sanitized inputs from local/share storage [VERIFIED: apps/main/modules/state.js]

Default summary experience
  -> category summary builder (new)
  -> summary card/list renderer (new or list-renderer extension)
  -> click card
  -> detail modal controller (new) using state.itemEditors or modal-specific draft state [ASSUMED]
  -> confirmation / pending save
  -> sanitizeInputs + persistPrimaryState + renderAll [VERIFIED: apps/main/modules/persistence-controller.js]

Preset quick setup
  -> preset modal controller (refactor existing bindPresetModal)
  -> percentage normalization on blur
  -> generated items + correction summary
  -> final confirmation keeps original percentages and rounded Won amounts
  -> commit through normalizeExternalStep1Inputs/sanitizeInputs [VERIFIED: apps/main/modules/event-bindings.js] [ASSUMED]

Account and Sankey correction
  -> normalize/correct account links before render
  -> buildMonthlySnapshot()
  -> buildSankeyData()
  -> individual income -> 총수입 -> accounts -> outflow totals/details
  -> renderSankey()
```

### Recommended Project Structure

```text
apps/main/modules/
├── financial-summary.js              # category totals, representative items, summary card view models [ASSUMED]
├── financial-summary-renderer.js     # summary group/card DOM rendering, no mutation [ASSUMED]
├── financial-modal-controller.js     # detail/edit and guided creation modal lifecycle [ASSUMED]
├── preset-setup-controller.js        # percentage preset modal and final confirmation [ASSUMED]
├── account-correction.js             # deterministic account recommendation and correction notes [ASSUMED]
├── input-sanitizer.js                # call correction during normalization, preserve modelVersion [VERIFIED: apps/main/modules/input-sanitizer.js]
├── sankey-builder.js                 # insert mandatory 총수입 topology [VERIFIED: apps/main/modules/sankey-builder.js]
└── sankey-renderer.js                # line-broken tooltip/details rendering, not topology [VERIFIED: apps/main/modules/sankey-renderer.js]
```

### Pattern 1: Step 3-Like Pending Detail Modal
**What:** Use a card click to open a modal draft, update derived stats in place, and commit only through an explicit save/confirmation path. [VERIFIED: apps/portfolio/app.js] [VERIFIED: apps/portfolio/modules/dom.js]  
**When to use:** Use for category cards (`수입`, `계좌`, `지출`, `저축`, `투자`) and guided item creation. [VERIFIED: 09-CONTEXT.md]  
**Example:**

```javascript
// Source: apps/portfolio/app.js + apps/portfolio/modules/dom.js
// Adapt the pattern, not the Step 3 data shape. [VERIFIED: local file read]
pendingModalChanges = { originalData, currentData };
onModalDataChange(updatedData, hasChanges) {
  pendingModalChanges.currentData = updatedData;
  if (hasChanges) showPendingBar();
}
```

### Pattern 2: Derived Stats Without Full Re-Render
**What:** Step 3 updates creator totals and ratios without rebuilding the whole form on every input. [VERIFIED: apps/portfolio/modules/dom.js]  
**When to use:** Use for preset percentages, amount correction preview, category totals, and modal amount edits. [ASSUMED]  
**Example:**

```javascript
// Source: apps/portfolio/modules/dom.js
const totalAmount = IsfCalculator.sumAmounts(assets);
const assetsWithRatios = IsfCalculator.calculateRatios(assets, totalAmount);
ratioSpan.textContent = `${as.ratio}%`;
```

### Pattern 3: Normalize at Boundaries
**What:** External Step 1 inputs are normalized before entering state through `normalizeExternalStep1Inputs()` and `sanitizeInputs()`. [VERIFIED: apps/main/modules/external-input-guard.js] [VERIFIED: apps/main/modules/persistence-controller.js]  
**When to use:** Use for account repair so localStorage, backup restore, JSON import, share code, hash restore, and preset commits all behave consistently. [VERIFIED: apps/main/modules/persistence-controller.js] [ASSUMED]  
**Example:**

```javascript
// Source: apps/main/modules/external-input-guard.js
export function normalizeExternalStep1Inputs(_source, rawInputs, fallback = DEFAULT_INPUTS) {
  const base = fallback ? cloneInputs(fallback) : cloneInputs(DEFAULT_INPUTS);
  const raw = rawInputs && typeof rawInputs === "object" ? rawInputs : {};
  return sanitizeInputs({ ...base, ...raw });
}
```

### Anti-Patterns to Avoid
- **Re-opening app-wide refactor:** `app.js` and `bootstrap-controller.js` are already thin enough for Phase 09; focus on UI/data behavior. [VERIFIED: apps/main/app.js] [VERIFIED: apps/main/modules/bootstrap-controller.js] [ASSUMED]
- **Patching Sankey in SVG only:** The mandatory `총수입` node must be a real node/link topology in `buildSankeyData()`. [VERIFIED: apps/main/modules/sankey-builder.js] [ASSUMED]
- **Silent account fallback:** Current `resolveAccountId()` silently falls back to magic defaults in Sankey; Phase 09 requires surfaced warning/correction notes. [VERIFIED: apps/main/modules/sankey-builder.js] [VERIFIED: 09-CONTEXT.md]
- **Inline modal HTML sprawl:** `list-renderer.js` and Step 3 DOM contain many `innerHTML` render paths; new user-controlled modal fields should preserve escaping or use DOM APIs for option/list construction. [VERIFIED: codebase grep]
- **Standalone detailed account model:** Bank names, balances, and detailed account types are out of scope. [VERIFIED: 09-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency formatting and Korean Won hints | New money parser/formatter | `IsfUtils.toWon`, `formatWonInputValue`, `formatMoney`, `convertToKoreanWon` | Existing Step 1 and Step 3 already rely on these helpers. [VERIFIED: apps/main/modules/list-renderer.js] [VERIFIED: apps/portfolio/modules/dom.js] |
| External data schema pipeline | Separate migration subsystem | `sanitizeInputs()` plus `normalizeExternalStep1Inputs()` | These are already used at import/restore/share boundaries. [VERIFIED: apps/main/modules/input-sanitizer.js] [VERIFIED: apps/main/modules/external-input-guard.js] |
| Sankey renderer/layout engine | New chart library | Existing `buildSankeyData()` and `renderSankey()` | Phase 09 changes topology, not the drawing engine. [VERIFIED: apps/main/modules/sankey-builder.js] [VERIFIED: apps/main/modules/sankey-renderer.js] |
| Confirmation modal mechanics | New app-wide modal framework | Shared `.modal-overlay` / `.modal-content` classes and Step 3 confirm modal pattern | Shared theme and Step 3 already provide the visual/interaction precedent. [VERIFIED: shared/styles/step-theme.css] [VERIFIED: apps/portfolio/modules/dom.js] |
| Account recommendation from scratch in multiple places | Per-render fallback logic | Central `account-correction.js` called by sanitizer and explicit refresh | Deterministic correction must affect persisted/loaded data consistently. [VERIFIED: 09-CONTEXT.md] [ASSUMED] |

**Key insight:** The complex part is data normalization and user-visible correction provenance, not rendering cards. If correction lives only inside renderers, storage/import/share paths will keep reintroducing mismatched account links. [VERIFIED: apps/main/modules/persistence-controller.js] [ASSUMED]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Step 1 active data uses storage key `isf-rebuild-v1`; Step 1 source also appears as `isf-step1-active` in the modern storage bridge; backups are in the shared backup store. [VERIFIED: apps/main/modules/constants.js] [VERIFIED: src/core/storage/IsfStore.ts] [VERIFIED: shared/storage/backup-manager.js] | Add account-link repair to normalization so existing saved/imported/restored records are corrected on load/commit. [ASSUMED] |
| Live service config | None found; app is static/local-first and no remote banking/service config is in scope. [VERIFIED: .planning/PROJECT.md] [VERIFIED: 09-CONTEXT.md] | None. [VERIFIED: 09-CONTEXT.md] |
| OS-registered state | None found in project references; PWA/service worker is browser-registered, not OS scheduler/service state. [VERIFIED: shared/pwa/pwa-manager.js] [VERIFIED: shared/legacy/sw.js] | Planner should not include OS migration tasks. [ASSUMED] |
| Secrets/env vars | No Step 1 secret/API env usage found by grep for env/secret/token/api key patterns. [VERIFIED: codebase grep] | None. [VERIFIED: codebase grep] |
| Build artifacts | Vite build and PWA cache assets exist conceptually; service worker caches core assets including `sankey-builder.js`. [VERIFIED: package.json] [VERIFIED: shared/legacy/sw.js] | After implementation, run build/check and ensure PWA version/cache update flow remains standard; no manual artifact migration needed. [ASSUMED] |

## Account Correction Heuristics

1. Build a valid account-id set from `inputs.accounts`; if accounts are missing, keep the existing aliases `급여계좌`, `생활비계좌`, and `주식계좌`. [VERIFIED: apps/main/modules/input-sanitizer.js]
2. For income, default `accountId` to `acc-salary`; if the user has not enabled multi-account split, normalize `allocations` to one allocation matching total income. [VERIFIED: constants.js] [VERIFIED: 09-CONTEXT.md] [ASSUMED]
3. For expense, default missing/invalid `accountId` to `acc-living`; for savings default to `acc-salary`; for invest default to `acc-stock`, falling back to the largest existing/suitable account if the magic id is absent. [VERIFIED: apps/main/modules/constants.js] [ASSUMED]
4. For income split allocations, if allocation total is lower or higher than item amount, apply the difference to the recommended/default account and attach a correction note for confirmation/modal badges. [VERIFIED: 09-CONTEXT.md] [ASSUMED]
5. For Sankey refresh, call the same correction helper rather than duplicating `resolveAccountId()` behavior inside `buildSankeyData()`. [VERIFIED: apps/main/modules/sankey-builder.js] [ASSUMED]

## Sankey Redesign

Current topology: income source nodes are column 0, account nodes are column 1/1.5, and outflow nodes are column 2. [VERIFIED: apps/main/modules/sankey-builder.js] Current links are `income -> account`, optional `account -> account` allocation/transfers, and `account -> outflow`. [VERIFIED: apps/main/modules/sankey-builder.js]

Recommended topology for Phase 09: [ASSUMED]

```text
Detail mode:
개별 수입(column 0)
  -> 총수입(column 1)
  -> 계좌(column 2)
  -> 지출/저축/투자 grouped/detail nodes(column 3)

Basic mode:
총수입(column 0 or 1)
  -> 계좌(column 1 or 2)
  -> 지출 총합 / 저축 총합 / 투자 총합(column 2 or 3)
```

Implementation notes:
- Add a stable node id such as `total-income` with label `총수입`; do not derive it from localized text. [ASSUMED]
- Link every positive `incomeBreakdown` item to `total-income`, including deficit pseudo-income only if the product wants deficit to enter the aggregate; otherwise keep deficit visually separate as a correction/shortfall node. [VERIFIED: apps/main/modules/calculator.js] [ASSUMED]
- Link `total-income` to accounts using normalized income allocations; when no split is enabled, route total income to the income deposit account. [VERIFIED: 09-CONTEXT.md] [ASSUMED]
- Keep `splitGroups` metadata for outflow totals, but change tooltip formatting from comma-joined dense text to line-broken list text or DOM-rendered rows. [VERIFIED: apps/main/modules/sankey-renderer.js] [VERIFIED: 09-CONTEXT.md]
- Update renderer layout assumptions because one extra column will change width/label placement and mobile collapse thresholds. [VERIFIED: apps/main/modules/sankey-renderer.js] [ASSUMED]

## Common Pitfalls

### Pitfall 1: Correcting Only in Sankey
**What goes wrong:** Cards/modals show one account link while Sankey silently renders another fallback. [VERIFIED: apps/main/modules/sankey-builder.js]  
**Why it happens:** Current `resolveAccountId()` fallback is local to the Sankey builder. [VERIFIED: apps/main/modules/sankey-builder.js]  
**How to avoid:** Centralize correction before snapshot/build and persist correction notes when appropriate. [ASSUMED]  
**Warning signs:** Tests pass for SVG labels but saved JSON/localStorage still contains invalid `accountId`. [ASSUMED]

### Pitfall 2: Losing Original Percent Intent
**What goes wrong:** Preset confirmation only shows rounded Won amounts and hides the user's original percentages. [VERIFIED: 09-CONTEXT.md]  
**Why it happens:** Existing preset generation returns only final item amounts and no percentage provenance. [VERIFIED: apps/main/modules/presets.js]  
**How to avoid:** Return a preset preview object with `originalPercent`, normalized percent, rounded amount, and correction delta. [ASSUMED]  
**Warning signs:** Confirmation rows cannot distinguish amount correction from percentage correction. [ASSUMED]

### Pitfall 3: Full Re-Renders During Modal Typing
**What goes wrong:** Input focus jumps or modal edits feel unstable. [VERIFIED: apps/portfolio/modules/dom.js]  
**Why it happens:** Existing list renderers often rebuild `innerHTML`. [VERIFIED: apps/main/modules/list-renderer.js]  
**How to avoid:** Use Step 3's partial stat update pattern for modal totals/ratios and only re-render full lists on save/cancel. [VERIFIED: apps/portfolio/modules/dom.js] [ASSUMED]  
**Warning signs:** Playwright needs arbitrary sleeps after every input before reading values. [ASSUMED]

### Pitfall 4: Mobile Card and Modal Overflow
**What goes wrong:** Summary cards, account badges, or modal rows overflow at 390px/768px. [VERIFIED: tests/step1.spec.ts]  
**Why it happens:** Existing Step 1 has dense grids and multiple mobile overrides. [VERIFIED: apps/main/styles.css]  
**How to avoid:** Add responsive constraints and Playwright viewport checks for 1280, 768, and 390 widths. [VERIFIED: tests/step1.spec.ts] [ASSUMED]

### Pitfall 5: Unsafe Dynamic HTML
**What goes wrong:** User-controlled names/groups/account aliases reach `innerHTML`. [VERIFIED: apps/main/modules/list-renderer.js]  
**Why it happens:** Step 1 and Step 3 render many rows via strings. [VERIFIED: codebase grep]  
**How to avoid:** Preserve `IsfUtils.escapeHtml()` for string templates and prefer `createElement`/`textContent` for new select options and confirmation rows. [VERIFIED: apps/main/modules/list-renderer.js] [ASSUMED]

## Code Examples

### Step 3 Confirmation Gate

```javascript
// Source: apps/portfolio/app.js [VERIFIED: local file read]
const newPortfolio = {
  id: `port-${Date.now()}`,
  name: activeCreator.name.trim(),
  period: activeCreator.period,
  totalAmount,
  assets: assetsWithRatios,
  createdAt: new Date().toISOString()
};
pendingNewPortfolio = newPortfolio;
IsfDom.showPortfolioConfirmModal(newPortfolio);
```

### Step 1 Persistence Commit

```javascript
// Source: apps/main/modules/persistence-controller.js [VERIFIED: local file read]
function commitImmediateInputs(inputs, options = {}) {
  state.inputs = sanitizeInputs(inputs);
  state.draftInputs = null;
  refreshInputsPanel(state.inputs);
  persistPrimaryState(state.inputs, options);
  renderAll();
}
```

### Current Sankey Fallback to Replace

```javascript
// Source: apps/main/modules/sankey-builder.js [VERIFIED: local file read]
function resolveAccountId(itemAccountId, magicDefault) {
  if (itemAccountId && accountIds.has(itemAccountId)) return itemAccountId;
  if (magicDefault && accountIds.has(magicDefault)) return magicDefault;
  return accounts[0]?.id || null;
}
```

### Existing Boundary Normalization

```javascript
// Source: apps/main/modules/external-input-guard.js [VERIFIED: local file read]
return sanitizeInputs({ ...base, ...raw });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dense Step 1 tab/list editor | Summary-first cards with detail modals is the Phase 09 locked target | Phase 09 context, 2026-06-18 | Planner should replace default surface, not add another tab. [VERIFIED: 09-CONTEXT.md] |
| Step 1 giant controller | Focused controller modules and thin bootstrap | Phase 07 complete, 2026-06-17 | Phase 09 should add narrow modules, not re-modularize from scratch. [VERIFIED: .planning/STATE.md] [VERIFIED: apps/main/app.js] |
| Individual incomes directly to accounts | Mandatory `총수입` aggregate between incomes and accounts | Phase 09 context, 2026-06-18 | `buildSankeyData()` topology must change. [VERIFIED: 09-CONTEXT.md] [VERIFIED: apps/main/modules/sankey-builder.js] |
| Immediate preset overwrite | Preset as core guided setup with confirmation and correction visibility | Phase 09 context, 2026-06-18 | Existing `bindPresetModal()` should be refactored. [VERIFIED: 09-CONTEXT.md] [VERIFIED: apps/main/modules/event-bindings.js] |

**Deprecated/outdated:**
- Standalone account-management product surface: explicitly rejected for this phase. [VERIFIED: 09-CONTEXT.md]
- Silent `미지정 계좌` fallback: conflicts with D-21/D-22/D-25 correction visibility. [VERIFIED: 09-CONTEXT.md] [VERIFIED: apps/main/modules/list-renderer.js]
- One-line merged Sankey tooltip metadata: conflicts with D-27. [VERIFIED: 09-CONTEXT.md] [VERIFIED: apps/main/modules/sankey-renderer.js]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Account correction should be centralized in a new `account-correction.js` module and called by sanitizer/refresh paths. | Architecture Patterns / Account Correction Heuristics | Planner may choose to place helper code inside `input-sanitizer.js`; behavior still must remain centralized. |
| A2 | `total-income` is a suitable stable id for `총수입`. | Sankey Redesign | If an existing id convention is preferred, tests must use the chosen stable id. |
| A3 | Preset preview should carry original percent, normalized percent, rounded amount, and correction delta. | Common Pitfalls / Preset Quick Setup | Without this shape, confirmation may fail D-12/D-13. |
| A4 | Basic mode may hide individual income nodes and start visually from `총수입`. | Sankey Redesign | If product requires incomes visible in basic mode, layout and tests must account for one more column. |

## Open Questions

1. **Should deficit pseudo-income flow into `총수입`?**  
   - What we know: `buildMonthlySnapshot()` currently adds `결손(부채/자산인출)` to `incomeBreakdown` when outflow exceeds income. [VERIFIED: apps/main/modules/calculator.js]  
   - What's unclear: Phase 09 says individual incomes flow to `총수입`, but does not state whether deficit should be represented as income or separate shortfall. [VERIFIED: 09-CONTEXT.md]  
   - Recommendation: Keep deficit separate from `총수입` unless the user explicitly wants borrowed/withdrawn funds counted in total income. [ASSUMED]

2. **Should preset quick setup overwrite existing items or create a preview merge?**  
   - What we know: current preset modal warns and overwrites via `commitImmediateInputs()`. [VERIFIED: apps/main/modules/event-bindings.js]  
   - What's unclear: Phase 09 requires final confirmation and correction visibility, but not merge-vs-overwrite behavior. [VERIFIED: 09-CONTEXT.md]  
   - Recommendation: Keep overwrite as the default after confirmation, with an explicit warning when existing data differs from defaults. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Vite, Playwright, scripts | yes | v24.15.0 | none needed. [VERIFIED: local CLI] |
| npm | package scripts | yes | 11.10.0 | none needed. [VERIFIED: local CLI] |
| Vite | dev server/build | yes | CLI resolved 5.4.21 | package script uses local dependency. [VERIFIED: local CLI] [VERIFIED: package.json] |
| Playwright | E2E/responsive/SVG tests | yes | 1.60.0 | none needed. [VERIFIED: local CLI] [VERIFIED: package.json] |

**Missing dependencies with no fallback:** none found. [VERIFIED: local CLI]  
**Missing dependencies with fallback:** none found. [VERIFIED: local CLI]

## Validation Architecture

Skipped because `.planning/config.json` sets `workflow.nyquist_validation` to `false`. [VERIFIED: .planning/config.json]  
Phase 09 still needs targeted verification because the user explicitly requested verification strategy. [VERIFIED: user prompt]

## Verification Strategy

| Focus | Test Type | Suggested Command | Coverage |
|-------|-----------|-------------------|----------|
| Summary card grouping | E2E | `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09 summary"` | Assert `수입+계좌` and `지출+저축+투자` groups, five category cards, totals, counts, representative lists, and Sankey below cards. [ASSUMED] |
| Detail modal and guided creation | E2E | `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09 modal"` | Click cards, edit item/account, create account inline, confirm, persist, reopen. [ASSUMED] |
| Preset quick setup | E2E/unit-style browser import | `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09 preset"` | Preset percentages normalize on blur, `사용자 지정` copies last preset, confirmation shows original percent and rounded Won. [ASSUMED] |
| Account repair | Browser module test through Playwright `page.evaluate()` | `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09 account correction"` | Inject malformed localStorage/import payload, verify deterministic repaired account ids and correction badges/notes. [ASSUMED] |
| Sankey topology | Browser module + SVG E2E | `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09 Sankey"` | Import `buildSankeyData()`, assert `total-income`/`총수입` node and links `income -> total-income -> account -> outflow`; assert basic/detail modes. [ASSUMED] |
| Mobile/visual regression | E2E screenshots | `npm run test:e2e -- tests/step1.spec.ts -g "Phase 09 mobile"` | 1280, 768, 390 viewport checks for no body overflow, readable modals, and nonblank Sankey. [ASSUMED] |
| Build/type safety | Static | `npm run check` and `npm run build` | TypeScript/Vite integration and entry import integrity. [VERIFIED: package.json] |

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Static local-first app has no authentication flow in Phase 09 scope. [VERIFIED: .planning/PROJECT.md] [VERIFIED: 09-CONTEXT.md] |
| V3 Session Management | partial | Browser localStorage/session/share/hash data must remain non-secret and user-clearable. [VERIFIED: apps/main/modules/storage-manager.js] [VERIFIED: apps/main/modules/persistence-controller.js] |
| V4 Access Control | no | No multi-user server/API boundary in this phase. [VERIFIED: .planning/PROJECT.md] |
| V5 Input Validation | yes | Use `sanitizeInputs()`, `normalizeExternalStep1Inputs()`, `IsfUtils.escapeHtml()`, and DOM `textContent`/`replaceChildren` for user-controlled fields. [VERIFIED: apps/main/modules/input-sanitizer.js] [VERIFIED: apps/main/modules/external-input-guard.js] [VERIFIED: codebase grep] |
| V6 Cryptography | no | No encryption/cryptographic operation is in Phase 09 scope. [VERIFIED: 09-CONTEXT.md] |

### Known Threat Patterns for Step 1

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stored XSS via imported account/item/group names | Tampering / Information Disclosure | Escape every string-template insertion and prefer DOM text APIs for new rows/options. [VERIFIED: tests/step1.spec.ts] [VERIFIED: apps/main/modules/list-renderer.js] |
| Data integrity drift from stale localStorage/backups | Tampering / Denial of Service | Normalize and repair account links at every external boundary. [VERIFIED: apps/main/modules/persistence-controller.js] [ASSUMED] |
| Misleading financial flow due to silent account fallback | Tampering | Persist or display correction notes/badges when auto-correction changes data. [VERIFIED: 09-CONTEXT.md] [ASSUMED] |
| Share/hash payload malformed shape | Denial of Service | Keep `normalizeExternalStep1Inputs()` and `sanitizeInputs()` as mandatory boundaries. [VERIFIED: apps/main/modules/external-input-guard.js] |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/09-step-1-financial-settings-input-uiux-rebuild/09-CONTEXT.md` - locked Phase 09 decisions, scope, and deferred ideas. [VERIFIED: local file read]
- `apps/main/modules/*.js` - Step 1 state, render, persistence, item editor, sanitizer, Sankey builder/renderer behavior. [VERIFIED: local file reads + codebase grep]
- `apps/portfolio/app.js`, `apps/portfolio/modules/dom.js`, `apps/portfolio/modules/state.js`, `apps/portfolio/modules/calculator.js` - Step 3 interaction reference. [VERIFIED: local file reads]
- `tests/step1.spec.ts` and `playwright.config.ts` - current verification patterns. [VERIFIED: local file reads]
- `DESIGN.md` and `shared/styles/step-theme.css` - design system constraints. [VERIFIED: local file reads]

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` - milestone context and current workflow state. [VERIFIED: local file reads]
- Phase 05/07/08 contexts - prior phase design and architecture constraints. [VERIFIED: local file reads]

### Tertiary (LOW confidence)
- GSD `research-plan` was run, but it routed repository-private questions to `websearch`; no web fetch was used because local code was the authoritative source. [VERIFIED: gsd-tools research-plan output] [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package scripts, local CLI versions, and existing tests were verified locally. [VERIFIED: package.json] [VERIFIED: local CLI]
- Architecture: HIGH - module boundaries and source files were read directly. [VERIFIED: local file reads]
- Sankey redesign: MEDIUM - current topology is verified, but exact `총수입` basic-mode layout and deficit treatment need implementation decisions. [VERIFIED: apps/main/modules/sankey-builder.js] [ASSUMED]
- Account migration heuristics: MEDIUM - correction requirement is locked, exact heuristic is discretionary. [VERIFIED: 09-CONTEXT.md] [ASSUMED]
- Pitfalls: HIGH for known code risks, MEDIUM for recommended mitigations. [VERIFIED: codebase grep] [ASSUMED]

**Research date:** 2026-06-18  
**Valid until:** 2026-07-18, unless Step 1 module structure changes before planning. [ASSUMED]
