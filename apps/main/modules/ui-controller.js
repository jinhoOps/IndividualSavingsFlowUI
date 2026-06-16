import { dom } from "./dom.js";
import { state } from "./state.js";
import { IsfUtils } from "../../../shared/core/utils.js";
import { 
  SANKEY_VALUE_MODES, MOBILE_LAYOUT_QUERY, FORM_FIELD_KEYS 
} from "./constants.js";
import * as helpers from "./state-helpers.js";
import { 
  formatCurrency, formatPercent, formatMonthSpan 
} from "./formatters.js";
import { 
  normalizeAllocationGroupName, getMonthlyIncomeTotalWon, getMonthlyAllocationTotalWon 
} from "./input-sanitizer.js";
import * as listRenderer from "./list-renderer.js";

export function syncViewModeUi() {
  if (dom.saveViewToLocal) dom.saveViewToLocal.hidden = !state.isViewMode;
}

export function syncViewModeGuideUi() {
  if (dom.viewModeGuide) dom.viewModeGuide.hidden = !state.isViewMode;
}

export function syncBackupUi() {
  if (dom.dataHubModal) dom.dataHubModal.updateBackupList(state.backupEntries);
}

export function syncSankeyValueModeUi() {
  if (!dom.sankeyViewAmount || !dom.sankeyViewPercent) return;
  const isAmt = state.sankeyValueMode === SANKEY_VALUE_MODES.AMOUNT;
  dom.sankeyViewAmount.classList.toggle("is-active", isAmt);
  dom.sankeyViewPercent.classList.toggle("is-active", !isAmt);
  dom.sankeyViewAmount.setAttribute("aria-selected", isAmt);
  dom.sankeyViewPercent.setAttribute("aria-selected", !isAmt);
}

export function syncSankeySortModeUi() {
  if (dom.sankeySortMode) dom.sankeySortMode.value = state.sankeySortMode;
}

export function syncSankeyGroupingUi() {
  if (dom.sankeyGroupingExpense) dom.sankeyGroupingExpense.value = state.sankeyGrouping.expense;
  if (dom.sankeyGroupingSavings) dom.sankeyGroupingSavings.value = state.sankeyGrouping.savings;
  if (dom.sankeyGroupingInvest) dom.sankeyGroupingInvest.value = state.sankeyGrouping.invest;
  const controls = dom.sankeyGroupingExpense ? dom.sankeyGroupingExpense.closest(".sankey-grouping-controls") : null;
  if (controls) {
    const show = state.sankeyDetailMode === "detail";
    controls.hidden = !show;
    controls.setAttribute("aria-hidden", show ? "false" : "true");
  }
}

export function syncSankeyZoomUi() {
  if (dom.sankeyZoomLabel) {
    dom.sankeyZoomLabel.textContent = `${Math.round(state.sankeyZoom * 100)}%`;
  }
}

export function syncItemSortModeUi() {
  const modes = state.itemSortModes;
  if (dom.expenseSortMode) dom.expenseSortMode.value = modes.expense;
  if (dom.savingsSortMode) dom.savingsSortMode.value = modes.savings;
  if (dom.investSortMode) dom.investSortMode.value = modes.invest;
}

export function syncMobileInputsPanelVisibility() {
  if (!dom.inputsPanel || !dom.toggleInputsMobile) return;
  const isCollapsed = state.mobileInputsCollapsed && window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
  dom.inputsPanel.classList.toggle("is-mobile-collapsed", isCollapsed);
  dom.toggleInputsMobile.textContent = isCollapsed ? "펼치기" : "접기";
}

export function syncMobileItemEditorFab() {
  if (!dom.mobileEditorFab) return;
  const isAnyEditing = state.itemEditors.expense.active || state.itemEditors.savings.active || state.itemEditors.invest.active;
  dom.mobileEditorFab.hidden = !isAnyEditing;
}

export function syncAdvancedTabBlockVisibility() {
  const tab = state.activeAdvancedTab;
  document.querySelectorAll("[data-advanced-block]").forEach(block => {
    block.classList.toggle("is-active", block.dataset.advancedBlock === tab);
  });
}

export function setActiveAdvancedTab(tabId) {
  state.activeAdvancedTab = tabId;
  [dom.advancedTabExpense, dom.advancedTabSavings, dom.advancedTabInvest].forEach(tab => {
    if (tab) tab.classList.toggle("is-active", tab.dataset.advancedTab === tabId);
  });
  syncAdvancedTabBlockVisibility();
}

export function setPendingBarVisible(visible) {
  // Removed
}

export function markPendingChanges() {
  // Removed
}

export function clearPendingChanges() {
  // Removed
}

export function refreshInputsPanel(inputs, warnings) {
  if (!dom.inputsForm) return;
  state.suspendInputTracking = true;
  helpers.applyInputsToForm(dom.inputsForm, inputs, { FORM_FIELD_KEYS, toMan: IsfUtils.toMan });
  
  const rawInputs = inputs;
  ["income", "account", "expense", "savings", "invest"].forEach(group => {
    const rawItems = group === "income" ? rawInputs.incomes : (group === "account" ? rawInputs.accounts : rawInputs[`${group}Items`]);
    listRenderer.renderItemList(group, rawItems, { 
      editing: state.itemEditors[group].active,
      warnings: group === "account" ? warnings : undefined
    });
  });

  syncDerivedMonthlyInputsToUi();
  syncGroupOptionsAll();
  IsfUtils.updateAllKoreanWonHints();
  state.suspendInputTracking = false;
}

export function syncDerivedMonthlyInputsToUi() {
  const inputs = state.inputs;
  const inc = getMonthlyIncomeTotalWon(inputs.incomes);
  const exp = getMonthlyAllocationTotalWon(inputs.expenseItems);
  const sav = getMonthlyAllocationTotalWon(inputs.savingsItems);
  const inv = getMonthlyAllocationTotalWon(inputs.investItems);

  if (dom.derivedMonthlyIncome) dom.derivedMonthlyIncome.value = inc.toLocaleString();
  if (dom.derivedMonthlyExpense) dom.derivedMonthlyExpense.value = exp.toLocaleString();
  if (dom.derivedMonthlySavings) dom.derivedMonthlySavings.value = sav.toLocaleString();
  if (dom.derivedMonthlyInvest) dom.derivedMonthlyInvest.value = inv.toLocaleString();
}

export function syncGroupOptionsAll() {
  ["expense", "savings", "invest"].forEach(syncGroupOptionsFor);
}

export function syncGroupOptionsFor(group) {
  const list = dom[`${group}GroupOptions`];
  if (!list) return;

  const inputs = state.inputs;
  const items = inputs[`${group}Items`] || [];
  const names = [...new Set(items.map(i => normalizeAllocationGroupName(i.group)).filter(Boolean))].sort();
  list.innerHTML = names.map(n => `<option value="${n}">`).join("");
}
