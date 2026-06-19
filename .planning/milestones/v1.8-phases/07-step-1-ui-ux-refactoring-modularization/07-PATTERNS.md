# Phase 07: Step 1 UI/UX Refactoring & Modularization - Pattern Map

**Mapped:** 2026-06-17
**Files analyzed:** 11
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/main/modules/bootstrap-controller.js` | controller | event-driven + request-response | `apps/main/modules/bootstrap-controller.js` | exact, split target |
| `apps/main/modules/event-bindings.js` | controller | event-driven | `apps/main/modules/bootstrap-controller.js` lines 213-425, 782-798 | role-match |
| `apps/main/modules/visualization-controller.js` | controller | event-driven | `apps/main/modules/bootstrap-controller.js` lines 427-596, 1098-1115 | exact |
| `apps/main/modules/render-orchestrator.js` | controller | transform + DOM render | `apps/main/modules/bootstrap-controller.js` lines 800-876 | exact |
| `apps/main/modules/persistence-controller.js` | controller/service | file-I/O + request-response | `apps/main/modules/bootstrap-controller.js` lines 892-989 | exact |
| `apps/main/modules/item-editor-controller.js` | controller | CRUD + event-driven | `apps/main/modules/bootstrap-controller.js` lines 686-706, 1004-1221 | exact |
| `apps/main/modules/ui-controller.js` | controller | DOM synchronization | `apps/main/modules/list-renderer.js` lines 389-406 | exact for safe options |
| `apps/main/modules/list-renderer.js` | renderer/component | transform + DOM render | `apps/main/modules/list-renderer.js` lines 93-112, 389-406 | exact |
| `apps/main/modules/external-input-guard.js` | utility | transform + validation | `apps/main/modules/external-input-guard.js` lines 1-7 | exact |
| `apps/main/app.js` | route/entry | bootstrap | `apps/main/app.js` lines 1-3 | exact |
| `tests/step1.spec.ts` | test | browser e2e | `tests/step1.spec.ts` lines 66-277 | exact |

## Pattern Assignments

### `apps/main/modules/bootstrap-controller.js` (controller, bootstrap)

**Analog:** `apps/main/app.js` and current `apps/main/modules/bootstrap-controller.js`

**Thin entry pattern** (`apps/main/app.js` lines 1-3):
```javascript
import { startStep1App } from "./modules/bootstrap-controller.js";

startStep1App();
```

**Bootstrap-only startup pattern** (`apps/main/modules/bootstrap-controller.js` lines 65-117):
```javascript
export function startStep1App() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

function init() {
  checkReturningUser();
  bindControls();
  syncViewModeUi();
  syncViewModeGuideUi();
  syncBackupUi();
  syncSankeyValueModeUi();
  syncSankeySortModeUi();
  syncSankeyGroupingUi();
  syncItemSortModeUi();
  syncMobileInputsPanelVisibility();
  setActiveAdvancedTab(state.activeAdvancedTab);
  syncAdvancedTabBlockVisibility();
  initMgmtTabs();
  refreshInputsPanel(state.inputs);
  syncGroupOptionsAll();
  setPendingBarVisible(false);
  renderAll();
  initializeBackupStore();
  void initializeInputsFromShareId();
  void initializeSnapshotSelector();
}
```

**Assignment:** Keep this file as startup wiring only. Move `bindControls`, visualization bindings, persistence/share/hash handlers, render orchestration, and item-editor mutation logic into focused modules, then import and call those modules from `init()`.

---

### `apps/main/modules/event-bindings.js` (controller, event-driven)

**Analog:** `apps/main/modules/bootstrap-controller.js`

**Imports pattern** (`bootstrap-controller.js` lines 1-63):
```javascript
import { IsfUtils } from "../../../shared/core/utils.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import * as helpers from "./state-helpers.js";
import * as listRenderer from "./list-renderer.js";
```

**Core event binding pattern** (`bootstrap-controller.js` lines 213-425):
```javascript
function bindControls() {
  bindModalEvents();

  if (dom.presetSalary) {
    dom.presetSalary.replaceChildren(...PRESET_SALARIES.map((salary, index) => {
      const option = document.createElement("option");
      option.value = String(salary.value);
      option.textContent = salary.label;
      option.selected = index === 2;
      return option;
    }));
  }

  if (dom.inputsForm) {
    dom.inputsForm.addEventListener("submit", (event) => {
      event.preventDefault();
    });
    const handleFormValueEvent = (event, options = {}) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !FORM_FIELD_KEYS.includes(target.name)) return;
      if (state.suspendInputTracking && !options.capture) return;
      state.inputs = sanitizeInputs(helpers.readInputsFromForm(dom.inputsForm, state.inputs, { FORM_FIELD_KEYS, toWon: IsfUtils.toWon }));
      helpers.syncDerivedValues(state.inputs, { getMonthlyAllocationTotalWon });
      listRenderer.renderInputHints(state.inputs);
      persistPrimaryState(state.inputs);
      window.clearTimeout(state.formRenderTimer);
      state.formRenderTimer = window.setTimeout(() => {
        renderAll();
      }, 150);
    };
    dom.inputsForm.addEventListener("input", (event) => handleFormValueEvent(event, { capture: true }), true);
  }
}
```

**Global event pattern** (`bootstrap-controller.js` lines 782-798):
```javascript
function bindGlobalEvents() {
  window.addEventListener("hashchange", handleHashChange);
  window.addEventListener("popstate", () => { syncViewModeUi(); syncViewModeGuideUi(); });
  window.addEventListener("resize", IsfUtils.debounce(() => state.snapshot && renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode), 120));
  const mq = window.matchMedia(MOBILE_LAYOUT_QUERY);
  const onChange = () => {
    if (!mq.matches) {
      state.mobileInputsCollapsed = false;
      if (state.activeAdvancedTab === "rates") setActiveAdvancedTab("expense");
    }
    syncMobileInputsPanelVisibility();
    syncAdvancedTabBlockVisibility();
    syncMobileItemEditorFab();
  };
  mq.addEventListener("change", onChange);
}
```

**Assignment:** Export a `bindStep1Events(commands)` function. Pass callbacks such as `renderAll`, `persistPrimaryState`, `setProjectionMode`, `setSankeyValueMode`, and modal handlers in a command object to avoid circular imports.

---

### `apps/main/modules/visualization-controller.js` (controller, event-driven)

**Analog:** `apps/main/modules/bootstrap-controller.js`

**Tab switching and tooltip pattern** (`bootstrap-controller.js` lines 427-554):
```javascript
function bindVisualizationAndTooltipEvents() {
  const sankeyTabBtns = [dom.showSankeyBasicBtn, dom.showSankeyDetailBtn, dom.showNetworkBtn].filter(Boolean);
  if (sankeyTabBtns.length === 3 && dom.visualizationSlider) {
    const switchVis = (activeBtn, detailMode, sliderIndex) => {
      sankeyTabBtns.forEach((btn) => {
        btn.classList.toggle("is-active", btn === activeBtn);
        btn.setAttribute("aria-selected", btn === activeBtn ? "true" : "false");
      });
      dom.visualizationSlider.style.transform = sliderIndex === 1 ? "translateX(-50%)" : "translateX(0%)";
      if (detailMode !== null) setSankeyDetailMode(detailMode);
      if (detailMode === null) {
        const controls = dom.sankeyGroupingExpense ? dom.sankeyGroupingExpense.closest(".sankey-grouping-controls") : null;
        if (controls) {
          controls.hidden = true;
          controls.setAttribute("aria-hidden", "true");
        }
      }
    };
    dom.showSankeyBasicBtn.addEventListener("click", () => switchVis(dom.showSankeyBasicBtn, "basic", 0));
    dom.showSankeyDetailBtn.addEventListener("click", () => switchVis(dom.showSankeyDetailBtn, "detail", 0));
    dom.showNetworkBtn.addEventListener("click", () => switchVis(dom.showNetworkBtn, null, 1));
  }
}
```

**Sankey setter pattern** (`bootstrap-controller.js` lines 1098-1115):
```javascript
function setSankeyValueMode(mode) {
  state.sankeyValueMode = mode; syncSankeyValueModeUi();
  renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode);
}

function setSankeyGrouping(category, value) {
  state.sankeyGrouping[category] = value;
  syncSankeyGroupingUi();
  if (state.snapshot) renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode);
}
```

**Assignment:** Move visualization tab events, transfer-rule UI events, tooltip formatting, and Sankey mode setters here. Keep renderer calls delegated to `sankey-renderer.js` and `network-map-renderer.js`.

---

### `apps/main/modules/render-orchestrator.js` (controller, transform + DOM render)

**Analog:** `apps/main/modules/bootstrap-controller.js`

**Render order pattern** (`bootstrap-controller.js` lines 800-876):
```javascript
function renderAll() {
  const inputs = getVisibleInputs();
  const snapshot = buildMonthlySnapshot(inputs);
  state.snapshot = snapshot;
  const projection = simulateProjection(inputs, { mode: state.projectionOptions.mode });
  const cards = buildSummaryCards(snapshot, projection, inputs.horizonYears);
  listRenderer.renderCards(cards, inputs.horizonYears);

  const { warnings } = calculateAccountFinancialIncomes(inputs);
  const sankeyData = buildSankeyData(snapshot, state.sankeySortMode, state.sankeyGrouping);
  const transfers = sankeyData ? sankeyData.transfers : [];
  renderSankey(snapshot, buildSankeyData, state.sankeySortMode);

  listRenderer.renderTransferRulesList(inputs.transfers || [], inputs.accounts);
  listRenderer.renderTransferSelectOptions(inputs.accounts);
  renderNetworkMap(dom.networkMapInner, accountsWithValues, transfers);
  listRenderer.renderProjectionTable(projection, inputs.horizonYears, inputs.annualExpenseGrowth);
  listRenderer.renderInputHints(inputs);
  refreshInputsPanel(inputs, warnings);
}
```

**Assignment:** Export `renderAll()` and projection setters. Preserve the order: visible inputs -> monthly snapshot -> projection -> summary cards -> warnings -> Sankey data/render -> transfer UI -> network map -> projection table -> input hints -> form refresh.

---

### `apps/main/modules/persistence-controller.js` (controller/service, file-I/O + request-response)

**Analog:** `apps/main/modules/bootstrap-controller.js` and `apps/main/modules/external-input-guard.js`

**External guard pattern** (`external-input-guard.js` lines 1-7):
```javascript
import { DEFAULT_INPUTS } from "./constants.js";
import { cloneInputs, sanitizeInputs } from "./input-sanitizer.js";

export function normalizeExternalStep1Inputs(_source, rawInputs, fallback = DEFAULT_INPUTS) {
  const base = fallback ? cloneInputs(fallback) : cloneInputs(DEFAULT_INPUTS);
  const raw = rawInputs && typeof rawInputs === "object" ? rawInputs : {};
  return sanitizeInputs({ ...base, ...raw });
}
```

**Commit and persistence pattern** (`bootstrap-controller.js` lines 892-919):
```javascript
function commitImmediateInputs(inputs, options = {}) {
  state.inputs = sanitizeInputs(inputs);
  state.draftInputs = null;
  setPendingBarVisible(false);
  refreshInputsPanel(state.inputs);
  persistPrimaryState(state.inputs, options);
  renderAll();
}

function persistPrimaryState(inputs, options = {}) {
  if (state.isViewMode) return;
  if (dom.appHeader) dom.appHeader.updateStatus("saving", "저장 중...");
  try {
    window.IsfStorageHub.saveLocal(STORAGE_KEY, inputs);
    if (!options.skipAutoBackup) {
      void (async () => {
        const res = await window.IsfStorageHub.triggerAutoBackup(SHARE_STATE_KEY, inputs, state.backupEntries);
        if (res.created) {
          state.backupEntries = res.nextEntries;
          syncBackupUi();
        }
      })();
    }
    if (dom.appHeader) dom.appHeader.updateStatus("success", "자동 저장됨");
  } catch (_e) {
    if (dom.appHeader) dom.appHeader.updateStatus("error", "저장 실패");
  }
}
```

**Inbound data boundary pattern** (`bootstrap-controller.js` lines 636-655, 943-985):
```javascript
const next = normalizeExternalStep1Inputs("isf-code-apply", decoded);
commitImmediateInputs(next);

commitImmediateInputs(normalizeExternalStep1Inputs("backup-restore", entry.data), { skipAutoBackup: true });
commitImmediateInputs(normalizeExternalStep1Inputs("json-import", imported));
const next = normalizeExternalStep1Inputs("hash-restore", hashInputs);
```

**Assignment:** Move backup, JSON import/export, view-save, reset, hash restore, share-id loading, ISF CODE apply/merge/generate, and primary persistence here. Every external source must call `normalizeExternalStep1Inputs()` before state commit.

---

### `apps/main/modules/item-editor-controller.js` (controller, CRUD + event-driven)

**Analog:** `apps/main/modules/bootstrap-controller.js`

**Binding pattern** (`bootstrap-controller.js` lines 686-706):
```javascript
function bindItemEditorEvents() {
  ["income", "expense", "savings", "invest", "account"].forEach(group => {
    const editBtn = dom[`edit${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    const addBtn = dom[`add${group.charAt(0).toUpperCase() + group.slice(1)}Item`];
    const applyBtn = dom[`apply${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    const cancelBtn = dom[`cancel${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    const list = dom[`${group}List`];
    if (editBtn) editBtn.addEventListener("click", () => toggleItemEditor(group));
    if (addBtn) addBtn.addEventListener("click", () => addItemToEditor(group));
    if (applyBtn) applyBtn.addEventListener("click", () => applyItemEditor(group));
    if (cancelBtn) cancelBtn.addEventListener("click", () => cancelItemEditor(group));
    if (list) {
      list.addEventListener("input", (e) => handleItemInput(group, e));
      list.addEventListener("click", (e) => handleItemClick(group, e));
    }
  });
}
```

**Validation and apply pattern** (`bootstrap-controller.js` lines 1132-1163):
```javascript
function applyItemEditor(group) {
  const editor = state.itemEditors[group];
  const draft = helpers.ensureDraftInputs(state);

  if (group === "income") {
    const incomes = editor.items;
    for (const item of incomes) {
      if (Array.isArray(item.allocations) && item.allocations.length > 0) {
        const allocTotal = item.allocations.reduce((sum, al) => sum + al.amount, 0);
        if (allocTotal > item.amount) {
          alert(`오류: '${item.name}' 항목의 계좌별 분배 금액 합계(${allocTotal.toLocaleString()}원, ${IsfUtils.convertToKoreanWon(allocTotal)})가 전체 수입 금액(${item.amount.toLocaleString()}원, ${IsfUtils.convertToKoreanWon(item.amount)})을 초과할 수 없습니다. 금액 조정을 해 주십시오.`);
          return;
        }
      }
    }
    draft.incomes = editor.items;
  } else if (group === "account") {
    draft.accounts = editor.items;
  } else {
    draft[`${group}Items`] = editor.items;
  }

  state.inputs = sanitizeInputs(draft);
  cancelItemEditor(group);
  markPendingChanges();
}
```

**Assignment:** Move item input/click handlers, editor start/apply/cancel/add, mobile editor buttons, and allocation-total validation here. Keep list HTML in `list-renderer.js`.

---

### `apps/main/modules/ui-controller.js` (controller, DOM synchronization)

**Analog:** `apps/main/modules/list-renderer.js`

**Current unsafe path to replace** (`ui-controller.js` lines 143-150):
```javascript
export function syncGroupOptionsFor(group) {
  const list = dom[`${group}GroupOptions`];
  if (!list) return;

  const inputs = state.inputs;
  const items = inputs[`${group}Items`] || [];
  const names = [...new Set(items.map(i => normalizeAllocationGroupName(i.group)).filter(Boolean))].sort();
  list.innerHTML = names.map(n => `<option value="${n}">`).join("");
}
```

**Safe option construction pattern** (`list-renderer.js` lines 389-406):
```javascript
export function renderTransferSelectOptions(accounts) {
  if (!dom.transferSourceSelect || !dom.transferTargetSelect) return;

  const buildOptions = () => {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "계좌 선택...";
    return [
      placeholder,
      ...accounts.map((account) => {
        const option = document.createElement("option");
        option.value = account.id;
        option.textContent = account.name;
        return option;
      }),
    ];
  };

  dom.transferSourceSelect.replaceChildren(...buildOptions());
  dom.transferTargetSelect.replaceChildren(...buildOptions());
}
```

**Assignment:** Replace `list.innerHTML = ...` with `list.replaceChildren(...names.map(...document.createElement("option")))`. Do not rely on `normalizeAllocationGroupName()` for escaping; it trims/slices but does not HTML-escape.

---

### `apps/main/modules/list-renderer.js` (renderer/component, transform + DOM render)

**Analog:** `apps/main/modules/list-renderer.js`

**Escaped grouped allocation pattern** (`list-renderer.js` lines 93-112):
```javascript
function renderGroupedAllocationList(group, items, options) {
  const groups = new Map();
  items.forEach((item) => {
    const groupName = getAllocationGroupName(group, item);
    if (!groups.has(groupName)) groups.set(groupName, []);
    groups.get(groupName).push(item);
  });

  return Array.from(groups.entries()).map(([groupName, groupItems], index) => {
    const total = groupItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const itemHtml = groupItems.map((item) => renderAllocationItemHtml(group, item, options)).join("");
    return `
      <details class="allocation-group" data-allocation-group="${IsfUtils.escapeHtml(groupName)}" ${index === 0 ? "open" : ""}>
        <summary class="allocation-group__summary">
          <span class="allocation-group__name">${IsfUtils.escapeHtml(groupName)}</span>
          <span class="allocation-group__meta">${groupItems.length}개 · ${formatCurrency(total)}</span>
        </summary>
        <div class="allocation-group__items">
          ${itemHtml}
        </div>
      </details>
    `;
  }).join("");
}
```

**Attribute risk note:** Continue escaping visible strings, but prefer DOM APIs for attribute values sourced from user/imported names or ids. The group-option gap exists because option values were interpolated as raw attributes.

---

### `tests/step1.spec.ts` (test, browser e2e)

**Analog:** `tests/step1.spec.ts`

**Phase 07 mobile test pattern** (`tests/step1.spec.ts` lines 66-148):
```typescript
test('Phase 07 mobile controls stay contained at 768px and 390px', async ({ page }) => {
  for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(100);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(4);

    for (const selector of ['.mgmt-tabs', '#visualizationToggle', '.sankey-head-tools']) {
      const locator = page.locator(selector).first();
      await expect(locator, `${selector} should be visible at ${viewport.width}px`).toBeVisible();
      const contained = await locator.evaluate((element) => element.scrollWidth <= element.clientWidth + 4 || window.getComputedStyle(element).overflowX !== 'visible');
      expect(contained, `${selector} should fit or scroll within itself at ${viewport.width}px`).toBe(true);
    }
  }
});
```

**Current failing collapse pattern** (`tests/step1.spec.ts` lines 246-277):
```typescript
test('Phase 07 rerun formats money fields and groups long item lists', async ({ page }) => {
  await page.locator('#mgmtTabFlow').click();
  const utilityGroup = page.locator('#expenseAdvancedBlock .allocation-group').filter({ hasText: '공과금' }).first();
  await expect(utilityGroup).toBeVisible();
  if (await utilityGroup.locator('.allocation-group__items').isVisible()) {
    await utilityGroup.locator('summary').click();
  }
  await expect(utilityGroup.locator('.allocation-group__items')).not.toBeVisible();
  await utilityGroup.locator('summary').click();
  await expect(utilityGroup.locator('.allocation-group__items')).toBeVisible();
  await utilityGroup.locator('summary').click();
  await expect(utilityGroup.locator('.allocation-group__items')).not.toBeVisible();
});
```

**Assignment:** Keep Phase 07 coverage in the existing file. Add or adjust assertions so the full `-g "Phase 07"` group proves collapsible allocation directories can repeatedly close/open after prior Phase 07 tests have changed localStorage, tabs, viewport, and controls state.

## Shared Patterns

### Module Boundary
**Source:** `apps/main/modules/state.js`, `state-helpers.js`, `ui-controller.js`, `list-renderer.js`
**Apply to:** All new controllers

Use the existing 3-layer boundary:
- `state.js` owns mutable Step 1 state.
- `state-helpers.js` owns form/state transforms and signatures.
- Renderer modules own DOM markup.
- Controller modules bind events and call render/persist/sync commands.

### External Data Guard
**Source:** `apps/main/modules/external-input-guard.js` lines 1-7
**Apply to:** `persistence-controller.js`, reset/preset/share/import/hash handlers

```javascript
return sanitizeInputs({ ...base, ...raw });
```

Every external or restored input path must pass through this before `commitImmediateInputs()`.

### Safe Option Rendering
**Source:** `apps/main/modules/list-renderer.js` lines 389-406
**Apply to:** `ui-controller.js`, account selects, group datalists, transfer selects

```javascript
const option = document.createElement("option");
option.value = account.id;
option.textContent = account.name;
```

Use `replaceChildren()` with created nodes for user/imported values. Avoid raw `innerHTML` for option values.

### Render Sequencing
**Source:** `apps/main/modules/bootstrap-controller.js` lines 800-876
**Apply to:** `render-orchestrator.js`

Preserve the current render order and warning propagation so modularization does not change visible behavior.

### Verification Gate
**Source:** `tests/step1.spec.ts` lines 66-277
**Apply to:** All Phase 07 gap closure work

Required commands for the planner:
```powershell
npm run check
npx playwright test tests/step1.spec.ts -g "Phase 07" --reporter=list --timeout=30000
```

## No Analog Found

No Phase 07 gap-closure file lacks a close in-repository analog. The strongest analogs are the current `bootstrap-controller.js` blocks being extracted, the existing safe DOM option pattern in `list-renderer.js`, and the existing Phase 07 Playwright tests.

## Metadata

**Analog search scope:** `apps/main/`, `apps/main/modules/`, `src/entries/`, `shared/core/`, `shared/styles/`, `tests/`
**Files scanned:** 25
**Pattern extraction date:** 2026-06-17
**Project instructions:** No `AGENTS.md` found in repository root.
**Project skills:** No local `.codex/skills/` or `.agents/skills/` directory found in this workspace.
