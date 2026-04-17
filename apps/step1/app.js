import {
  MONEY_UNIT, STORAGE_KEY, SHARE_STATE_KEY, SHARE_STATE_SCHEMA,
  HASH_STATE_PARAM, VIEW_MODE_GUIDE_DISMISSED_KEY, MANUAL_BACKUP_WINDOW_MS,
  MAX_INCOME_ITEMS, MAX_ALLOCATION_ITEMS, SANKEY_VALUE_MODES,
  SANKEY_SORT_MODES, ITEM_SORT_MODES, SANKEY_ZOOM_MIN, SANKEY_ZOOM_MAX, SANKEY_ZOOM_STEP,
  MOBILE_LAYOUT_QUERY, DEFAULT_INPUTS, DEFAULT_EXPENSE_ITEMS,
  DEFAULT_SAVINGS_ITEMS, DEFAULT_INVEST_ITEMS, SAMPLE_INPUTS,
  FORM_FIELD_KEYS, TONE_COLORS
} from "./modules/constants.js";

import {
  cloneInputs, sanitizeInputs, createIncomeItem,
  getMonthlyIncomeTotalMan, getMonthlyAllocationTotalMan,
  normalizeAllocationGroupName, parseSavingsAnnualRateInput,
  createAllocationItemId, normalizeAllocationName, normalizeMaturityMonth,
  buildAllocationMetaText, scaleDefaultAllocationItemsToTotal,
  sanitizeInteger, sanitizeAllocationItems, sanitizeSavingsItems,
  sanitizeSavingsAnnualRate
} from "./modules/input-sanitizer.js";

import {
  formatCurrency, formatSignedCurrency, formatPercent,
  formatMonthSpan, formatBackupTimestamp, formatSankeyDisplayValue
} from "./modules/formatters.js";

import {
  persistInputs, loadPersistedInputs, saveShareSnapshot,
  loadShareSnapshotById
} from "./modules/storage-manager.js";

import {
  persistStep1BridgeSnapshot
} from "./modules/bridge-manager.js";

import {
  buildMonthlySnapshot, simulateProjection, buildSummaryCards
} from "./modules/calculator.js";

import { dom } from "./modules/dom.js";
import { state } from "./modules/state.js";

import {
  renderSankey, hideSankeyTooltip, getEffectiveSankeyZoom
} from "./modules/sankey-renderer.js";

import { buildSankeyData } from "./modules/sankey-builder.js";

// --- Initialization ---

function init() {
  checkReturningUser();
  bindControls();
  syncViewModeUi();
  syncViewModeGuideUi();
  syncBackupUi();
  syncSankeyValueModeUi();
  syncSankeySortModeUi();
  syncSankeyZoomUi();
  syncItemSortModeUi();
  setActiveAdvancedTab(state.activeAdvancedTab);
  syncAdvancedTabBlockVisibility();
  refreshInputsPanel(state.inputs);
  syncGroupOptionsAll();
  setPendingBarVisible(false);
  renderAll();
  initializeBackupStore();
  void initializeInputsFromShareId();

  const pwaManager = new IsfPwaManager({
    appVersion: "0.5.1",
    appKey: SHARE_STATE_KEY,
    onFeedback: (message) => IsfFeedback.showFeedback(dom.applyFeedback, message),
    isViewMode: () => state.isViewMode,
    swPath: "../../sw.js",
    manifestPath: "../../manifest.webmanifest",
    versionCheckTriggerElement: dom.checkLatestVersion,
    getCurrentData: () => state.inputs,
  });
  pwaManager.init();

  if (state.isViewMode) {
    IsfFeedback.showFeedback(dom.applyFeedback, "보기 모드로 열었습니다. 로컬 저장값은 변경되지 않습니다.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function checkReturningUser() {
  if (state.isViewMode || hasShareState()) return;
  const persisted = loadPersistedInputs();
  if (persisted) {
    state.isDashboardMode = true;
    document.body.classList.add("is-dashboard-mode");
    state.mobileInputsCollapsed = true;
    syncMobileInputsPanelVisibility();
  }
}

// --- Event Binding ---

function bindControls() {
  bindModalEvents();

  if (dom.inputsForm) {
    dom.inputsForm.addEventListener("input", (event) => {
      if (state.suspendInputTracking) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !FORM_FIELD_KEYS.includes(target.name)) return;
      
      const baseInputs = ensureDraftInputs();
      state.draftInputs = sanitizeInputs(readInputsFromForm(baseInputs));
      markPendingChanges();
    });
  }

  bindReadonlyAdvancedNavigation();
  
  [dom.advancedTabExpense, dom.advancedTabSavings, dom.advancedTabInvest, dom.advancedTabRates].forEach(tab => {
    if (tab) tab.addEventListener("click", () => navigateToAdvancedGroup(tab.dataset.advancedTab));
  });

  [dom.expenseSortMode, dom.savingsSortMode, dom.investSortMode].forEach(sel => {
    if (sel) sel.addEventListener("change", () => setItemSortMode(sel.id.replace("SortMode", ""), sel.value));
  });

  if (dom.sankeyViewAmount) dom.sankeyViewAmount.addEventListener("click", () => setSankeyValueMode(SANKEY_VALUE_MODES.AMOUNT));
  if (dom.sankeyViewPercent) dom.sankeyViewPercent.addEventListener("click", () => setSankeyValueMode(SANKEY_VALUE_MODES.PERCENT));
  if (dom.sankeySortMode) dom.sankeySortMode.addEventListener("change", () => setSankeySortMode(dom.sankeySortMode.value));

  if (dom.toggleInputsMobile) dom.toggleInputsMobile.addEventListener("click", () => {
    if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches) return;
    state.mobileInputsCollapsed = !state.mobileInputsCollapsed;
    syncMobileInputsPanelVisibility();
  });

  if (dom.sankeyZoomIn) dom.sankeyZoomIn.addEventListener("click", () => setSankeyZoom(state.sankeyZoom + SANKEY_ZOOM_STEP));
  if (dom.sankeyZoomOut) dom.sankeyZoomOut.addEventListener("click", () => setSankeyZoom(state.sankeyZoom - SANKEY_ZOOM_STEP));
  if (dom.sankeyZoomReset) dom.sankeyZoomReset.addEventListener("click", () => setSankeyZoom(1));

  if (dom.saveViewToLocal) dom.saveViewToLocal.addEventListener("click", handleSaveViewToLocal);
  if (dom.dismissViewModeGuide) dom.dismissViewModeGuide.addEventListener("click", dismissViewModeGuide);
  if (dom.returnToNormalMode) dom.returnToNormalMode.addEventListener("click", switchToNormalMode);

  bindItemEditorEvents();
  bindActionButtons();
  bindGlobalEvents();
}

function bindModalEvents() {
  if (!dom.appHeader || !dom.dataHubModal) return;
  dom.appHeader.addEventListener("open-data-hub", () => {
    dom.dataHubModal.updateBackupList(state.backupEntries);
    dom.dataHubModal.open();
  });
  dom.dataHubModal.addEventListener("restore-backup", async (e) => {
    await restoreBackupById(e.detail.backupId);
    dom.dataHubModal.close();
  });
  dom.dataHubModal.addEventListener("export-json", handleExportJson);
  dom.dataHubModal.addEventListener("import-json", async (e) => {
    await handleImportJson(e.detail.file);
    dom.dataHubModal.close();
  });
  dom.dataHubModal.addEventListener("backup-now", handleManualBackup);
  dom.dataHubModal.addEventListener("copy-share-link", handleCopyShareLink);
}

function bindItemEditorEvents() {
  ["income", "expense", "savings", "invest"].forEach(group => {
    const list = dom[`${group}List`];
    if (list) {
      list.addEventListener("input", (e) => handleItemInput(group, e));
      list.addEventListener("click", (e) => handleItemClick(group, e));
    }
    const editBtn = dom[`edit${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    if (editBtn) editBtn.addEventListener("click", () => toggleItemEditor(group));
    
    const addBtn = dom[`add${group.charAt(0).toUpperCase() + group.slice(1)}Item`];
    if (addBtn) addBtn.addEventListener("click", () => addItemToEditor(group));

    const applyBtn = dom[`apply${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    if (applyBtn) applyBtn.addEventListener("click", () => applyItemEditor(group));

    const cancelBtn = dom[`cancel${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    if (cancelBtn) cancelBtn.addEventListener("click", () => cancelItemEditor(group));
  });

  if (dom.mobileEditorAdd) dom.mobileEditorAdd.addEventListener("click", () => addItemToEditor(getActiveItemEditorGroupKey()));
  if (dom.mobileEditorApply) dom.mobileEditorApply.addEventListener("click", () => applyItemEditor(getActiveItemEditorGroupKey()));
  if (dom.mobileEditorCancel) dom.mobileEditorCancel.addEventListener("click", () => cancelItemEditor(getActiveItemEditorGroupKey()));
}

function bindActionButtons() {
  if (dom.loadSample) dom.loadSample.addEventListener("click", handleLoadSample);
  if (dom.resetInputs) dom.resetInputs.addEventListener("click", handleResetInputs);
  if (dom.applyChanges) dom.applyChanges.addEventListener("click", applyPendingChanges);
  if (dom.cancelChanges) dom.cancelChanges.addEventListener("click", cancelPendingChanges);
  if (dom.jumpToInputs) dom.jumpToInputs.addEventListener("click", () => document.getElementById("cardsTitle")?.scrollIntoView({ behavior: "smooth" }));
  if (dom.jumpToTop) dom.jumpToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function bindGlobalEvents() {
  window.addEventListener("hashchange", handleHashChange);
  window.addEventListener("popstate", () => { syncViewModeUi(); syncViewModeGuideUi(); });
  window.addEventListener("resize", IsfUtils.debounce(() => state.snapshot && renderSankey(state.snapshot, buildSankeyData), 120));
  
  const mq = window.matchMedia(MOBILE_LAYOUT_QUERY);
  const onChange = () => {
    if (!mq.matches) {
      state.mobileInputsCollapsed = false;
      if (state.activeAdvancedTab === "rates") setActiveAdvancedTab("expense");
    }
    syncMobileInputsPanelVisibility();
    syncAdvancedTabBlockVisibility();
    syncAllItemEditorUi();
  };
  mq.addEventListener("change", onChange);
  window.addEventListener("orientationchange", () => window.setTimeout(() => { if (dom.sankeySvg) dom.sankeySvg.removeAttribute("viewBox"); renderAll(); }, 200));
}

// --- Main Logic & State Transitions ---

function renderAll() {
  const snapshot = buildMonthlySnapshot(state.inputs);
  state.snapshot = snapshot;
  const projection = simulateProjection(state.inputs);
  const cards = buildSummaryCards(snapshot, projection, state.inputs.horizonYears);

  renderCards(cards, state.inputs.horizonYears);
  renderSankey(snapshot, buildSankeyData);
  renderProjectionTable(projection, state.inputs.horizonYears, state.inputs.annualExpenseGrowth);
  renderInputHints(state.inputs);
}

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
    persistInputs(inputs);
    if (!options.skipAutoBackup) {
      void (async () => {
        const res = await IsfBackupManager.maybeCreateAutoBackupIfDue(state.backupEntries, inputs, SHARE_STATE_KEY);
        if (res.created) {
          state.backupEntries = res.nextEntries;
          syncBackupUi();
        }
      })();
    }
    void persistStep1BridgeSnapshot(inputs, { getHubStorage: () => IsfHubStorage, isViewMode: state.isViewMode });
    if (dom.appHeader) dom.appHeader.updateStatus("success", "자동 저장됨");
  } catch (_e) {
    if (dom.appHeader) dom.appHeader.updateStatus("error", "저장 실패");
  }
}

// --- Specific Handlers ---

async function handleManualBackup() {
  if (state.isViewMode || !state.backupStoreReady) return;
  const res = await IsfBackupManager.createBackupEntry(state.backupEntries, state.inputs, {
    type: "manual", source: "normal", allowDuplicate: true,
    replaceRecentManualWithinMs: MANUAL_BACKUP_WINDOW_MS, appKey: SHARE_STATE_KEY,
    onRecentManualOverwriteConfirm: () => window.confirm("최근 1분 이내 수동 백업이 있습니다. 덮어쓸까요?")
  });
  if (res.created) {
    state.backupEntries = res.nextEntries;
    syncBackupUi();
    if (dom.appHeader) dom.appHeader.updateStatus("success", "백업 저장됨");
  }
}

async function restoreBackupById(id) {
  const entry = state.backupEntries.find(e => e.id === id);
  if (!entry || !window.confirm(`백업(${formatBackupTimestamp(entry.createdAt)})으로 복원할까요? 현재 상태는 자동 백업됩니다.`)) return;
  await handleManualBackup();
  commitImmediateInputs(entry.data, { skipAutoBackup: true });
}

function handleExportJson() {
  IsfShare.exportAsJson(IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, state.inputs), "my-household-flow");
}

async function handleImportJson(file) {
  try {
    const imported = IsfShare.parseImportedJson(await file.text(), SHARE_STATE_KEY);
    commitImmediateInputs(imported);
  } catch (_e) { if (dom.appHeader) dom.appHeader.updateStatus("error", "JSON 오류"); }
}

async function handleCopyShareLink() {
  const link = await IsfShare.buildShareLink(state.inputs, { viewMode: true });
  if (link && navigator.clipboard) {
    await navigator.clipboard.writeText(link);
    if (dom.appHeader) dom.appHeader.updateStatus("success", "공유 링크 복사됨");
  } else if (link) window.prompt("링크 복사:", link);
}

async function handleSaveViewToLocal() {
  const localInputs = sanitizeInputs(cloneInputs(state.inputs));
  persistInputs(localInputs);
  const res = await IsfBackupManager.createBackupEntry(state.backupEntries, localInputs, { type: "manual", source: "view-save", appKey: SHARE_STATE_KEY });
  if (res.created) { state.backupEntries = res.nextEntries; syncBackupUi(); }
  switchToNormalMode();
}

function handleLoadSample() {
  IsfShare.buildShareLink({ ...SAMPLE_INPUTS }, { viewMode: true }).then(link => { if (link) window.location.href = link; });
}

function handleResetInputs() {
  if (state.isViewMode || !window.confirm("모든 금액을 0으로 초기화할까요?")) return;
  commitImmediateInputs(createResetInputs(state.inputs));
}

function applyPendingChanges() {
  if (!state.draftInputs) return;
  state.inputs = sanitizeInputs(state.draftInputs);
  state.draftInputs = null;
  setPendingBarVisible(false);
  refreshInputsPanel(state.inputs);
  persistPrimaryState(state.inputs);
  renderAll();
}

function cancelPendingChanges() {
  state.draftInputs = null;
  setPendingBarVisible(false);
  refreshInputsPanel(state.inputs);
  renderAll();
}

function handleHashChange() {
  syncViewModeUi(); syncViewModeGuideUi();
  if (state.isApplyingHashState) return;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get(HASH_STATE_PARAM);
  const hashInputs = IsfShare.decodePayloadFromHash(hash, SHARE_STATE_KEY);
  if (!hashInputs) return;
  const next = sanitizeInputs({ ...DEFAULT_INPUTS, ...hashInputs });
  if (JSON.stringify(next) === JSON.stringify(state.inputs)) return;
  state.isApplyingHashState = true;
  try { commitImmediateInputs(next); } finally { state.isApplyingHashState = false; }
}

function handleItemInput(group, event) {
  if (state.suspendInputTracking) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;

  if (state.itemEditors[group].active) {
    const itemId = target.dataset.editorId || target.dataset.incomeId;
    const field = target.dataset.field;
    if (!itemId || !field) return;
    const item = state.itemEditors[group].items.find(e => e.id === itemId);
    if (!item) return;

    if (field === "name") item.name = target.value.slice(0, 24);
    if (field === "amount") item.amount = IsfUtils.sanitizeMoney(target.value, 0);
    if (field === "group") item.group = normalizeAllocationGroupName(target.value);
    if (field === "annualRate") {
        const parsed = parseSavingsAnnualRateInput(target.value, getVisibleInputs().annualSavingsYield);
        if (parsed === null) delete item.annualRate; else item.annualRate = parsed;
    }
    if (field === "maturityMonth") {
        const norm = normalizeMaturityMonth(target.value);
        if (!norm) delete item.maturityMonth; else item.maturityMonth = norm;
    }
    
    const totalMan = group === "income" ? getMonthlyIncomeTotalMan(state.itemEditors[group].items) : getMonthlyAllocationTotalMan(state.itemEditors[group].items);
    const won = IsfUtils.toWon(totalMan);
    if (group === "income") renderIncomeTotalHint(won, state.itemEditors[group].items.length);
    else if (group === "expense") renderExpenseTotalHint(won, state.itemEditors[group].items.length);
    else if (group === "savings") renderSavingsTotalHint(won, state.itemEditors[group].items.length);
    else if (group === "invest") renderInvestTotalHint(won, state.itemEditors[group].items.length);
    
    setItemEditorUi(group, true);
    return;
  }

  // Non-editing mode input (for simple items)
  const itemId = target.dataset.incomeId || target.dataset.expenseId || target.dataset.savingsId || target.dataset.investId;
  const field = target.dataset.field;
  if (!itemId) return;

  const draft = ensureDraftInputs();
  const listField = group === "income" ? "incomes" : `${group}Items`;
  const item = draft[listField].find(i => i.id === itemId);
  if (!item) return;

  if (field === "name") item.name = target.value.slice(0, 24);
  if (field === "amount") item.amount = IsfUtils.sanitizeMoney(target.value, 0);
  if (field === "annualRate" && group === "savings") {
      const parsed = parseSavingsAnnualRateInput(target.value, draft.annualSavingsYield);
      if (parsed === null) delete item.annualRate; else item.annualRate = parsed;
  }
  markPendingChanges();
}

function handleItemClick(group, event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const removeId = target.dataset.removeIncome || target.dataset.removeEditorItem;
  if (!removeId) return;

  if (state.itemEditors[group].active) {
    if (state.itemEditors[group].items.length <= 1) return;
    state.itemEditors[group].items = state.itemEditors[group].items.filter(i => i.id !== removeId);
    renderItemList(group, state.itemEditors[group].items, { editing: true });
    const totalMan = group === "income" ? getMonthlyIncomeTotalMan(state.itemEditors[group].items) : getMonthlyAllocationTotalMan(state.itemEditors[group].items);
    const won = IsfUtils.toWon(totalMan);
    if (group === "income") renderIncomeTotalHint(won, state.itemEditors[group].items.length);
    else if (group === "expense") renderExpenseTotalHint(won, state.itemEditors[group].items.length);
    else if (group === "savings") renderSavingsTotalHint(won, state.itemEditors[group].items.length);
    else if (group === "invest") renderInvestTotalHint(won, state.itemEditors[group].items.length);
    setItemEditorUi(group, true);
    return;
  }

  // Non-editing removal (for income)
  if (group === "income") {
      const draft = ensureDraftInputs();
      if (draft.incomes.length <= 1) return;
      draft.incomes = draft.incomes.filter(i => i.id !== removeId);
      state.draftInputs = sanitizeInputs(draft);
      renderIncomeList(state.draftInputs.incomes);
      markPendingChanges();
  }
}

// --- UI Helpers & Syncers ---

function setPendingBarVisible(visible) {
  if (dom.pendingBar) dom.pendingBar.hidden = !visible;
  if (dom.pendingSummary) dom.pendingSummary.textContent = visible ? getPendingSummaryText(state.draftInputs) : "";
}

function markPendingChanges() {
  if (!state.draftInputs || state.isViewMode) return;
  syncDerivedMonthlyInputs(state.draftInputs);
  renderInputHints(state.draftInputs);
  setPendingBarVisible(true);
}

function hasPendingChanges() { return !!state.draftInputs && JSON.stringify(state.draftInputs) !== JSON.stringify(state.inputs); }

function ensureDraftInputs() {
  if (!state.draftInputs) state.draftInputs = sanitizeInputs(cloneInputs(state.inputs));
  return state.draftInputs;
}

function syncBackupUi() { if (dom.dataHubModal) dom.dataHubModal.updateBackupList(state.backupEntries); }

function syncSankeyValueModeUi() {
  [dom.sankeyViewAmount, dom.sankeyViewPercent].forEach(btn => {
    if (btn) btn.classList.toggle("is-active", btn.dataset.sankeyView === state.sankeyValueMode);
  });
}

function setSankeyValueMode(mode) {
  state.sankeyValueMode = mode; syncSankeyValueModeUi();
  renderSankey(state.snapshot, buildSankeyData);
}

function syncSankeySortModeUi() { if (dom.sankeySortMode) dom.sankeySortMode.value = state.sankeySortMode; }
function setSankeySortMode(mode) { state.sankeySortMode = mode; syncSankeySortModeUi(); renderSankey(state.snapshot, buildSankeyData); }

function syncSankeyZoomUi() {
  if (dom.sankeyZoomLabel) dom.sankeyZoomLabel.textContent = `${Math.round(state.sankeyZoom * 100)}%`;
  renderSankey(state.snapshot, buildSankeyData);
}

function setSankeyZoom(zoom) { state.sankeyZoom = Math.min(SANKEY_ZOOM_MAX, Math.max(SANKEY_ZOOM_MIN, zoom)); syncSankeyZoomUi(); }

function syncItemSortModeUi() {
  ["expense", "savings", "invest"].forEach(g => { if (dom[`${g}SortMode`]) dom[`${g}SortMode`].value = state.itemSortModes[g]; });
}

function setItemSortMode(group, mode) {
  state.itemSortModes[group] = mode;
  const inputs = getVisibleInputs();
  renderItemList(group, inputs[`${group}Items`], { editing: state.itemEditors[group].active });
  syncItemSortModeUi();
}

function setActiveAdvancedTab(tab) {
  state.activeAdvancedTab = tab;
  [dom.advancedTabExpense, dom.advancedTabSavings, dom.advancedTabInvest, dom.advancedTabRates].forEach(btn => {
    if (btn) btn.classList.toggle("is-active", btn.dataset.advancedTab === tab);
  });
  syncAdvancedTabBlockVisibility();
}

function syncAdvancedTabBlockVisibility() {
  const isMobile = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
  [dom.expenseAdvancedBlock, dom.savingsAdvancedBlock, dom.investAdvancedBlock, dom.ratesAdvancedBlock].forEach(block => {
    if (block) {
      const active = block.dataset.advancedBlock === state.activeAdvancedTab;
      block.hidden = block.dataset.advancedBlock === "rates" ? (isMobile ? !active : false) : !active;
    }
  });
}

function getVisibleInputs() { return state.draftInputs || state.inputs; }

function refreshInputsPanel(inputs) {
  state.suspendInputTracking = true;
  try {
    applyInputsToForm(inputs);
    renderIncomeList(inputs.incomes);
    renderExpenseList(inputs.expenseItems);
    renderSavingsList(inputs.savingsItems);
    renderInvestList(inputs.investItems);
    syncDerivedMonthlyInputs(inputs);
    renderInputHints(inputs);
    syncGroupOptionsAll();
  } finally { state.suspendInputTracking = false; }
}

function renderIncomeList(items) { renderItemList("income", items); }
function renderExpenseList(items) { renderItemList("expense", items); }
function renderSavingsList(items) { renderItemList("savings", items); }
function renderInvestList(items) { renderItemList("invest", items); }

function applyInputsToForm(inputs) {
  FORM_FIELD_KEYS.forEach(key => {
    const field = dom.inputsForm?.elements?.[key];
    if (field) field.value = String(inputs[key]);
  });
}

// --- Item Editor Core ---

function toggleItemEditor(group) { state.itemEditors[group].active ? cancelItemEditor(group) : startItemEditor(group); }

function startItemEditor(group) {
  closeAllItemEditors(group);
  const items = cloneInputs(getVisibleInputs()[group === "income" ? "incomes" : `${group}Items`]);
  state.itemEditors[group] = { active: true, items, baselineSignature: getItemEditorSignature(group, items) };
  renderItemList(group, items, { editing: true });
  setItemEditorUi(group, true);
}

function applyItemEditor(group) {
  const editor = state.itemEditors[group];
  const draft = ensureDraftInputs();
  if (group === "income") draft.incomes = editor.items;
  else draft[`${group}Items`] = editor.items;
  state.draftInputs = sanitizeInputs(draft);
  cancelItemEditor(group);
  markPendingChanges();
}

function cancelItemEditor(group) {
  state.itemEditors[group].active = false;
  renderItemList(group, getVisibleInputs()[group === "income" ? "incomes" : `${group}Items`]);
  setItemEditorUi(group, false);
}

function addItemToEditor(group) {
  const editor = state.itemEditors[group];
  if (!editor.active || editor.items.length >= MAX_ALLOCATION_ITEMS) return;
  editor.items.push(group === "income" ? createIncomeItem() : { id: createAllocationItemId(group, editor.items.length), name: "", amount: 0 });
  renderItemList(group, editor.items, { editing: true });
}

function setItemEditorUi(group, active) {
  const actions = dom[`${group}EditorActions`]; if (actions) actions.hidden = !active;
  const editBtn = dom[`edit${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
  if (editBtn) editBtn.textContent = active ? "편집 완료" : "항목 편집";
  syncMobileItemEditorFab();
  syncGroupOptionsFor(group);
}

function closeAllItemEditors(except = "") {
  ["income", "expense", "savings", "invest"].forEach(g => { if (g !== except && state.itemEditors[g].active) cancelItemEditor(g); });
}

// --- Suggester ---
function syncGroupOptionsAll() { ["expense", "savings", "invest"].forEach(syncGroupOptionsFor); }
function syncGroupOptionsFor(group) {
  const list = dom[`${group}GroupOptions`]; if (!list) return;
  const items = getVisibleInputs()[`${group}Items`] || [];
  const names = [...new Set(items.map(i => normalizeAllocationGroupName(i.group)).filter(Boolean))].sort();
  list.innerHTML = names.map(n => `<option value="${n}">`).join("");
}

// --- Sub-Renderers ---

function renderCards(cards, horizonYears) {
  if (!dom.summaryCards) return;
  dom.summaryCards.innerHTML = "";
  cards.forEach(card => {
    const el = document.createElement("article");
    el.className = `card ${card.variant || ""}`;
    el.innerHTML = `<span class="label">${card.label}</span><span class="value">${card.value}</span><span class="sub">${card.sub}</span>`;
    dom.summaryCards.appendChild(el);
  });
}

function renderProjectionTable(records, horizonYears, expenseGrowth) {
  if (!dom.projectionTableBody) return;
  dom.projectionTableBody.innerHTML = records.map((r, i) => {
    if (i > 0 && i % 12 !== 0 && i !== records.length - 1) return "";
    return `<tr><td>${i === 0 ? "현재" : `${i / 12}년 후`}</td><td>${formatCurrency(r.monthlyIncome)}</td><td>${formatCurrency(r.monthlyExpense)}</td><td>${formatCurrency(r.debtInterest)}</td><td>${formatCurrency(r.actualDebtPayment)}</td><td>${formatCurrency(r.newBorrowing)}</td><td>${formatCurrency(r.cash)}</td><td>${formatCurrency(r.savings)}</td><td>${formatCurrency(r.invest)}</td><td>${formatCurrency(r.debt)}</td><td class="fw-bold">${formatCurrency(r.netAsset)}</td><td class="text-muted small">${formatCurrency(r.realNetAsset)}</td></tr>`;
  }).join("");
}

function renderItemList(group, items, options = {}) {
  const list = dom[`${group}List`]; if (!list) return;
  list.innerHTML = items.map((item, idx) => group === "income" ? renderIncomeItemHtml(item, options) : renderAllocationItemHtml(group, item, options)).join("");
}

function renderIncomeItemHtml(item, opts) {
  const isEditing = !!opts.editing;
  return `
    <div class="income-row">
      <input type="text" value="${item.name}" data-income-id="${item.id}" data-field="name" ${isEditing ? "" : "readonly"} placeholder="이름" />
      <input type="number" value="${item.amount}" data-income-id="${item.id}" data-field="amount" ${isEditing ? "" : "readonly"} placeholder="금액" />
      ${isEditing ? `
        <button class="income-remove" data-remove-income="${item.id}" title="삭제">
          <svg class="income-remove-icon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          <span class="income-remove-text">삭제</span>
        </button>
      ` : ""}
    </div>
  `;
}

function renderAllocationItemHtml(group, item, opts) {
  const isEditing = !!opts.editing;
  const meta = buildAllocationMetaText(item, { showMaturity: group !== "expense" });
  const metaHtml = (!isEditing && meta) ? `<div class="allocation-meta">${meta}</div>` : "";
  
  const commonClasses = `${group}-row ${isEditing ? "is-editing" : ""}`;
  
  if (!isEditing) {
    return `
      <div class="${commonClasses}">
        <span class="${group}-name">${item.name}</span>
        <span class="value">${formatCurrency(IsfUtils.toWon(item.amount))}</span>
        ${metaHtml}
      </div>
    `;
  }

  // Editing Mode
  const isSavings = group === "savings";
  const isInvest = group === "invest";
  const isExpense = group === "expense";

  return `
    <div class="${commonClasses}">
      <div class="editor-field">
        <label class="editor-field-label">이름</label>
        <input type="text" value="${item.name}" data-field="name" data-editor-id="${item.id}" placeholder="항목명" />
      </div>
      <div class="editor-field">
        <label class="editor-field-label">금액(만원)</label>
        <input type="number" value="${item.amount}" data-field="amount" data-editor-id="${item.id}" placeholder="금액" />
      </div>
      <div class="editor-field">
        <label class="editor-field-label">그룹</label>
        <input type="text" value="${item.group || ""}" data-field="group" data-editor-id="${item.id}" list="${group}GroupOptions" placeholder="그룹" />
      </div>
      ${isSavings ? `
        <div class="editor-field">
          <label class="editor-field-label">연이율(%)</label>
          <input type="number" value="${item.annualRate || ""}" data-field="annualRate" data-editor-id="${item.id}" step="0.1" placeholder="기본값" />
        </div>
      ` : ""}
      ${(isSavings || isInvest) ? `
        <div class="editor-field">
          <label class="editor-field-label">만기/해지월</label>
          <input type="month" value="${item.maturityMonth || ""}" data-field="maturityMonth" data-editor-id="${item.id}" />
        </div>
      ` : ""}
      <button class="allocation-remove" data-remove-editor-item="${item.id}" title="삭제">×</button>
    </div>
  `;
}

// --- Final Helpers ---
function getPendingSummaryText(inputs) {
  const monthlyIncome = IsfUtils.toWon(getMonthlyIncomeTotalMan(inputs.incomes));
  const monthlyOutflow = IsfUtils.toWon(inputs.monthlyExpense + inputs.monthlySavings + inputs.monthlyInvest + inputs.monthlyDebtPayment);
  return `수입 ${formatCurrency(monthlyIncome)} / 지출 ${formatCurrency(monthlyOutflow)}`;
}

function syncDerivedMonthlyInputs(inputs) {
  inputs.monthlyExpense = getMonthlyAllocationTotalMan(inputs.expenseItems);
  inputs.monthlySavings = getMonthlyAllocationTotalMan(inputs.savingsItems);
  inputs.monthlyInvest = getMonthlyAllocationTotalMan(inputs.investItems);
}

function renderInputHints(inputs) {
  renderIncomeTotalHint(IsfUtils.toWon(getMonthlyIncomeTotalMan(inputs.incomes)), inputs.incomes.length);
  renderExpenseTotalHint(IsfUtils.toWon(inputs.monthlyExpense), inputs.expenseItems.length);
  renderSavingsTotalHint(IsfUtils.toWon(inputs.monthlySavings), inputs.savingsItems.length);
  renderInvestTotalHint(IsfUtils.toWon(inputs.monthlyInvest), inputs.investItems.length);
}

function renderIncomeTotalHint(won, count) { if (dom.incomeTotalHint) dom.incomeTotalHint.textContent = `총 ${count}개 항목: ${formatCurrency(won)}`; }
function renderExpenseTotalHint(won, count) { if (dom.expenseTotalHint) dom.expenseTotalHint.textContent = `총 ${count}개 항목: ${formatCurrency(won)}`; }
function renderSavingsTotalHint(won, count) { if (dom.savingsTotalHint) dom.savingsTotalHint.textContent = `총 ${count}개 항목: ${formatCurrency(won)}`; }
function renderInvestTotalHint(won, count) { if (dom.investTotalHint) dom.investTotalHint.textContent = `총 ${count}개 항목: ${formatCurrency(won)}`; }

function navigateToAdvancedGroup(group) { setActiveAdvancedTab(group); if (dom.advancedSettings) dom.advancedSettings.open = true; }
function syncMobileInputsPanelVisibility() {
  const isMobile = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
  if (dom.inputsPanelContent) dom.inputsPanelContent.hidden = isMobile && state.mobileInputsCollapsed;
  if (dom.toggleInputsMobile) dom.toggleInputsMobile.hidden = !isMobile;
}

function getItemEditorSignature(group, items) { return JSON.stringify(items.map(i => ({ name: i.name, amount: i.amount }))); }
function syncMobileItemEditorFab() {} // Simplified
function syncViewModeUi() { if (dom.saveViewToLocal) dom.saveViewToLocal.hidden = !state.isViewMode; }
function syncViewModeGuideUi() { if (dom.viewModeGuide) dom.viewModeGuide.hidden = !state.isViewMode; }
function dismissViewModeGuide() { if (dom.viewModeGuide) dom.viewModeGuide.hidden = true; }
function switchToNormalMode() { window.location.href = window.location.pathname; }
function hasShareState() { return !!IsfShare.getShareIdFromUrl(); }
function bindReadonlyAdvancedNavigation() {
  dom.jumpAdvancedFields.forEach(field => {
    field.addEventListener("click", () => navigateToAdvancedGroup(field.dataset.advancedTarget));
  });
}

function readInputsFromForm(base) {
  const raw = { ...base };
  FORM_FIELD_KEYS.forEach(key => { const field = dom.inputsForm?.elements?.[key]; if (field) raw[key] = Number(field.value); });
  return raw;
}

function initializeBackupStore() {
  if (!IsfBackupManager.isIndexedDbAvailable()) return;
  IsfBackupManager.loadBackupEntriesFromDb(SHARE_STATE_KEY).then(entries => {
    state.backupStoreReady = true;
    if (entries) { state.backupEntries = entries; syncBackupUi(); }
  }).catch(() => { state.backupStoreReady = true; state.backupStoreError = true; });
}
async function initializeInputsFromShareId() {
  const sid = IsfShare.getShareIdFromUrl();
  if (sid) {
    const sidInputs = await loadShareSnapshotById(sid, (id) => id);
    if (sidInputs) commitImmediateInputs(sidInputs);
  }
}
