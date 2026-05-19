import { dom } from "./dom.js";
import { state } from "./state.js";
import { IsfUtils } from "../../../shared/core/utils.js";
import { 
  SANKEY_VALUE_MODES, MOBILE_LAYOUT_QUERY, FORM_FIELD_KEYS 
} from "./constants.js";
import * as helpers from "./state-helpers.js";
import { 
  formatCurrency, formatPercent, formatMonthSpan, 
  buildAllocationMetaText 
} from "./formatters.js";

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
  const isAnyEditing = state.itemEditor.expense || state.itemEditor.savings || state.itemEditor.invest;
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
  [dom.advancedTabExpense, dom.advancedTabSavings, dom.advancedTabInvest, dom.advancedTabRates].forEach(tab => {
    if (tab) tab.classList.toggle("is-active", tab.dataset.advancedTab === tabId);
  });
  syncAdvancedTabBlockVisibility();
}

export function setPendingBarVisible(visible) {
  if (dom.pendingBar) dom.pendingBar.hidden = !visible;
}

export function markPendingChanges() {
  setPendingBarVisible(true);
}

export function clearPendingChanges() {
  setPendingBarVisible(false);
}

export function refreshInputsPanel(inputs) {
  if (!dom.inputsForm) return;
  state.suspendInputTracking = true;
  helpers.writeInputsToForm(dom.inputsForm, inputs, { FORM_FIELD_KEYS, toMan: IsfUtils.toMan });
  state.suspendInputTracking = false;
  
  syncDerivedMonthlyInputsToUi();
  syncGroupOptionsAll();
}

export function syncDerivedMonthlyInputsToUi() {
  const inputs = state.draftInputs || state.inputs;
  const inc = IsfUtils.toMan(helpers.getMonthlyIncomeTotalWon(inputs));
  const exp = IsfUtils.toMan(helpers.getMonthlyAllocationTotalWon(inputs.expenseItems));
  const sav = IsfUtils.toMan(helpers.getMonthlyAllocationTotalWon(inputs.savingsItems));
  const inv = IsfUtils.toMan(helpers.getMonthlyAllocationTotalWon(inputs.investItems));

  if (dom.derivedMonthlyIncome) dom.derivedMonthlyIncome.value = inc.toLocaleString();
  if (dom.derivedMonthlyExpense) dom.derivedMonthlyExpense.value = exp.toLocaleString();
  if (dom.derivedMonthlySavings) dom.derivedMonthlySavings.value = sav.toLocaleString();
  if (dom.derivedMonthlyInvest) dom.derivedMonthlyInvest.value = inv.toLocaleString();
}

export function syncGroupOptionsAll() {
  ["expense", "savings", "invest"].forEach(syncGroupOptionsFor);
}

export function syncGroupOptionsFor(group) {
  const listKey = `${group}Items`;
  const containerId = `${group}List`;
  const container = document.getElementById(containerId);
  if (!container) return;

  const items = (state.draftInputs || state.inputs)[listKey];
  const sorted = helpers.getSortedItems(items, state.itemSortModes[group]);
  
  const editingId = state.itemEditor[group];
  const html = sorted.map(item => renderAllocationItemHtml(group, item, { isEditing: item.id === editingId })).join("");
  container.innerHTML = html || `<p class="empty">등록된 항목이 없습니다.</p>`;
}

function renderAllocationItemHtml(group, item, opts) {
  const { isEditing } = opts;
  const rowClass = `${group}-row ${isEditing ? 'is-editing' : ''}`;
  const nameClass = `${group}-name`;
  const amtMan = IsfUtils.toMan(item.amountWon);
  
  if (isEditing) {
    const isSavings = group === 'savings';
    return `
      <div class="${rowClass}" data-item-id="${item.id}">
        <div class="editor-field">
          <label class="editor-field-label">항목명</label>
          <input type="text" class="edit-name" value="${IsfUtils.escapeHtml(item.name)}" placeholder="이름">
        </div>
        <div class="editor-field">
          <label class="editor-field-label">금액(만원)</label>
          <input type="number" class="edit-amount" value="${amtMan}" placeholder="금액">
        </div>
        ${isSavings ? `
          <div class="editor-field">
            <label class="editor-field-label">수익률(%)</label>
            <input type="number" class="edit-rate" value="${item.annualRate || 0}" step="0.1" placeholder="수익률">
          </div>
          <div class="editor-field">
            <label class="editor-field-label">만기(개월)</label>
            <input type="number" class="edit-maturity" value="${item.maturityMonth || 0}" placeholder="만기">
          </div>
        ` : ''}
        <div class="editor-actions">
          <button class="btn btn-primary btn-sm apply-item-edit">적용</button>
          <button class="btn btn-ghost btn-sm cancel-item-edit">취소</button>
          <button class="btn btn-ghost btn-sm remove-item" style="color:var(--status-error)">삭제</button>
        </div>
      </div>
    `;
  }

  const metaText = buildAllocationMetaText(item, group);
  return `
    <div class="${rowClass}" data-item-id="${item.id}">
      <div class="allocation-label">
        <span class="${nameClass}">${IsfUtils.escapeHtml(item.name)}</span>
        ${metaText ? `<span class="allocation-meta">${metaText}</span>` : ''}
      </div>
      <span class="value">${amtMan.toLocaleString()} 만원</span>
      <button class="btn btn-ghost btn-sm edit-item-trigger">편집</button>
    </div>
  `;
}
