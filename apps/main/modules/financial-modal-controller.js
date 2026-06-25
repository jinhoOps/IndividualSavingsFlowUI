import { IsfUtils } from "../../../shared/core/utils.js";

import {
  normalizeAllocationGroupName,
  parseSavingsAnnualRateInput,
  isVariableExpenseItem,
} from "./input-sanitizer.js";
import { recommendAccountId } from "./account-correction.js";
import { dom } from "./dom.js";
import {
  buildVariableExpenseBudgetRows,
  buildVariableExpenseRangeSummary,
} from "./household-budget.js";

const CATEGORY_CONFIG = {
  income: { label: "수입", itemKey: "incomes", accountLabel: "입금 계좌" },
  account: { label: "계좌", itemKey: "accounts", accountLabel: "" },
  expense: { label: "지출", itemKey: "expenseItems", accountLabel: "출금 계좌" },
  savings: { label: "저축", itemKey: "savingsItems", accountLabel: "이체 계좌" },
  invest: { label: "투자", itemKey: "investItems", accountLabel: "투자 계좌" },
};

const OUTFLOW_CATEGORIES = ["expense", "savings", "invest"];
const INTEGRATED_CATEGORIES = ["income", "expense", "savings", "invest"];
const DETAIL_TABS = [
  { key: "income", label: "월 수입", categories: ["income"], createCategory: "income" },
  { key: "living", label: "월 생활비", categories: ["expense"], createCategory: "expense" },
  { key: "invest", label: "투자", categories: ["invest"], createCategory: "invest" },
  { key: "savings", label: "저축", categories: ["savings"], createCategory: "savings" },
  { key: "result", label: "결과/자동 저축", categories: [], createCategory: "savings" },
];
const ADJUSTMENT_BASIS = [
  { key: "invest-first", label: "투자 먼저 줄이기" },
  { key: "savings-first", label: "저축 먼저 줄이기" },
  { key: "proportional", label: "저축/투자 비율 유지해서 같이 줄이기" },
];
const CLOSE_CONFIRM_MESSAGE = "변경된 내용을 저장하지 않고 닫으시겠습니까?";

function clone(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function safeItems(items) {
  return Array.isArray(items) ? items : [];
}

function createText(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function getAccountName(accounts, accountId) {
  return safeItems(accounts).find((account) => account.id === accountId)?.name || "계좌 선택";
}

function formatAmount(value) {
  return IsfUtils.formatWonInputValue(Number(value) || 0);
}

function formatMoneyInput(value) {
  return IsfUtils.formatWonInputValue(Math.max(0, Number(value) || 0));
}

function normalizeMoneyValue(value) {
  const text = String(value ?? "").trim();
  if (text.startsWith("-")) {
    return { value: 0, error: "금액은 0원 이상이어야 합니다." };
  }
  const amount = Math.max(0, IsfUtils.toWon(text || "0"));
  if (amount % 1000 !== 0) {
    return { value: amount, error: "금액은 1,000원 단위로 입력해 주세요." };
  }
  return { value: amount, error: "" };
}

function getRowKey(category, index) {
  return `${category}:${index}`;
}

function isTemporaryItem(item) {
  return Boolean(item?.__temporary);
}

function isEmptyTemporaryItem(item) {
  return isTemporaryItem(item)
    && !String(item?.name || "").trim()
    && (Number(item?.amount) || 0) <= 0
    && (Number(item?.varianceAmount) || 0) <= 0;
}

function stripDraftItemMeta(item) {
  const { __temporary: _temporary, ...rest } = item || {};
  return rest;
}

function createAccountSelect(accounts, selectedAccountId, fieldName) {
  const select = document.createElement("select");
  select.dataset.financialModalField = fieldName;

  safeItems(accounts).forEach((account) => {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = account.name;
    option.selected = account.id === selectedAccountId;
    select.appendChild(option);
  });
  return select;
}

function getItemLabel(item, category, index) {
  return item.name || `${CATEGORY_CONFIG[category]?.label || "항목"} ${index + 1}`;
}

function buildGroupOptions(items, category) {
  const groups = new Set([CATEGORY_CONFIG[category]?.label || "기타"]);
  safeItems(items).forEach((item) => {
    const group = normalizeAllocationGroupName(item.group || "");
    if (group) groups.add(group);
  });
  return Array.from(groups);
}

function createGroupSelect(items, category, selectedGroup, forceCustom = false) {
  const normalizedGroup = normalizeAllocationGroupName(selectedGroup || "");
  const options = buildGroupOptions(items, category);
  const select = document.createElement("select");
  select.dataset.financialModalField = "groupMode";

  options.forEach((group) => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    option.selected = group === normalizedGroup;
    select.appendChild(option);
  });

  const custom = document.createElement("option");
  custom.value = "__custom__";
  custom.textContent = "직접 입력";
  custom.selected = forceCustom || (Boolean(normalizedGroup) && !options.includes(normalizedGroup));
  select.appendChild(custom);

  return select;
}

function appendField(container, labelText, control) {
  const label = document.createElement("label");
  label.className = "financial-modal-field";
  label.appendChild(createText("span", "financial-modal-field__label", labelText));
  label.appendChild(control);
  container.appendChild(label);
}

function getItemsForCategory(inputs, category) {
  const config = CATEGORY_CONFIG[category];
  return config ? clone(inputs[config.itemKey] || []) : [];
}

function setItemsForCategory(inputs, category, items) {
  const config = CATEGORY_CONFIG[category];
  if (!config) return inputs;
  return {
    ...inputs,
    [config.itemKey]: items,
  };
}

function validateItems(category, items) {
  const config = CATEGORY_CONFIG[category];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const display = item.name || `${index + 1}번째 ${config.label}`;
    if (!String(item.name || "").trim()) {
      return `${display} 이름을 입력해 주세요.`;
    }
    if (category !== "account") {
      const amount = Number(item.amount) || 0;
      if (amount < 1000) return `${display} 금액은 최소 1,000원 이상이어야 합니다.`;
      if (amount % 1000 !== 0) return `${display} 금액은 1,000원 단위로 입력해 주세요.`;
    }
  }
  return "";
}

function findFirstValidationError(category, items) {
  const config = CATEGORY_CONFIG[category];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!String(item.name || "").trim()) {
      return { category, index, message: "이름을 입력해 주세요." };
    }
    if (category !== "account") {
      const amount = Number(item.amount) || 0;
      if (amount < 0) return { category, index, message: "금액은 0원 이상이어야 합니다." };
      if (amount % 1000 !== 0) return { category, index, message: "금액은 1,000원 단위로 입력해 주세요." };
      if (amount < 1000) return { category, index, message: `${config.label} 금액은 최소 1,000원 이상이어야 합니다.` };
      if (category === "expense" && isVariableExpenseItem(item) && (Number(item.varianceAmount) || 0) % 1000 !== 0) {
        return { category, index, message: "금액은 1,000원 단위로 입력해 주세요." };
      }
    }
  }
  return null;
}

export function createFinancialModalController({ persistence, getVisibleInputs, renderAll } = {}) {
  let activeCategory = "";
  let baselineInputs = null;
  let draftItems = [];
  let createDraft = null;
  let createStep = "detail";
  let editingIndex = { category: "", index: -1 };
  let activeOutflowTab = "income";
  let outflowDrafts = null;
  let customGroupNames = {};
  let customGroupIndexes = new Set();
  let householdContextChanged = false;
  let selectedAdjustmentBasis = "";
  let adjustmentFeedback = "";
  let rowErrors = {};

  function getInputs() {
    return typeof getVisibleInputs === "function" ? getVisibleInputs() : {};
  }

  function isOutflowCategory(category) {
    return INTEGRATED_CATEGORIES.includes(category);
  }

  function isOutflowMode() {
    return isOutflowCategory(activeCategory) && outflowDrafts;
  }

  function getRenderedCategories() {
    if (!isOutflowMode()) return [activeCategory];
    return DETAIL_TABS.find((tab) => tab.key === activeOutflowTab)?.categories || [];
  }

  function getDraftItemsForCategory(category) {
    return isOutflowMode() ? safeItems(outflowDrafts?.[category]) : draftItems;
  }

  function getPersistableDraftItemsForCategory(category) {
    return getDraftItemsForCategory(category)
      .filter((item) => !isEmptyTemporaryItem(item))
      .map(stripDraftItemMeta);
  }

  function setDraftItemsForCategory(category, items) {
    if (isOutflowMode()) {
      outflowDrafts = {
        ...outflowDrafts,
        [category]: items,
      };
      if (category === activeCategory) draftItems = items;
      return;
    }
    draftItems = items;
  }

  function getAllOutflowDraftItems() {
    return INTEGRATED_CATEGORIES.flatMap((category) => getDraftItemsForCategory(category));
  }

  function getCreateCategory() {
    if (!isOutflowMode()) return activeCategory;
    return DETAIL_TABS.find((tab) => tab.key === activeOutflowTab)?.createCategory || "expense";
  }

  function getGroupNames(category) {
    const groups = new Set([CATEGORY_CONFIG[category]?.label || "기타"]);
    getDraftItemsForCategory(category).forEach((item) => {
      const group = normalizeAllocationGroupName(item.group || "");
      if (group) groups.add(group);
    });
    safeItems(customGroupNames[category]).forEach((group) => {
      if (group) groups.add(group);
    });
    return Array.from(groups);
  }

  function getRenderedGroupNames() {
    const categories = getRenderedCategories();
    const groups = new Set();
    categories.forEach((category) => {
      getGroupNames(category).forEach((group) => groups.add(group));
    });
    return Array.from(groups);
  }

  function getFutureDisplayGroup(item) {
    const group = normalizeAllocationGroupName(item?.group || "");
    if (!group || group === "저축" || group === "투자") return "저축-투자";
    return group;
  }

  function hasEditingSelection() {
    return Boolean(editingIndex?.category) && Number(editingIndex.index) >= 0;
  }

  function syncFinancialModalPendingBar() {
    if (!dom.financialModalPendingBar) return;
    const isVisible = hasDraftChanges();

    if (isVisible) {
      if (dom.financialModalPendingBar.hidden || dom.financialModalPendingBar.style.display === "none") {
        const animations = ["anim-slide-up", "anim-fade-scale", "anim-bounce-in"];
        const randomAnim = animations[Math.floor(Math.random() * animations.length)];
        
        dom.financialModalPendingBar.classList.remove("anim-slide-up", "anim-fade-scale", "anim-bounce-in");
        dom.financialModalPendingBar.classList.add(randomAnim);
        
        dom.financialModalPendingBar.hidden = false;
        dom.financialModalPendingBar.style.display = "";
      }
    } else {
      dom.financialModalPendingBar.hidden = true;
      dom.financialModalPendingBar.style.display = "none";
    }
  }

  function convertToSelect(badge, idx, accounts) {
    const category = badge.dataset.badgeAccountCategory || activeCategory;
    const select = document.createElement("select");
    select.className = "financial-modal-account-inline-select";
    accounts.forEach((acc) => {
      const opt = document.createElement("option");
      opt.value = acc.id;
      opt.textContent = acc.name;
      if (acc.id === getDraftItemsForCategory(category)[idx]?.accountId) opt.selected = true;
      select.appendChild(opt);
    });
    
    select.onchange = () => {
      const items = getDraftItemsForCategory(category);
      if (!items[idx]) return;
      items[idx].accountId = select.value;
      if (category === "income") {
        items[idx].allocations = [{ accountId: select.value, amount: Number(items[idx].amount) || 0 }];
      }
      setDraftItemsForCategory(category, items);
      renderRows();
      syncFinancialModalPendingBar();
    };
    select.onblur = () => {
      renderRows();
    };
    badge.replaceWith(select);
    select.focus();
  }

  function syncStats() {
    if (!dom.financialModalSummary) return;
    if (isOutflowMode()) {
      renderSummaryRail();
      return;
    }
    const total = activeCategory === "account"
      ? draftItems.length
      : draftItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalLabel = activeCategory === "account" ? `${draftItems.length}개 계좌` : IsfUtils.formatMoney(total);
    dom.financialModalSummary.textContent = `${CATEGORY_CONFIG[activeCategory]?.label || ""} ${draftItems.length}개 · ${totalLabel}`;
  }

  function sumDraftCategory(category) {
    return getDraftItemsForCategory(category).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  function getRailState() {
    const income = sumDraftCategory("income");
    const living = sumDraftCategory("expense");
    const invest = sumDraftCategory("invest");
    const savings = sumDraftCategory("savings");
    const availableAfterLiving = Math.max(0, income - living);
    const futureCommitment = savings + invest;
    const automaticSavings = Math.max(0, availableAfterLiving - futureCommitment);
    const overBudget = futureCommitment > availableAfterLiving;
    const totalSavings = savings + automaticSavings;
    return {
      income,
      living,
      invest,
      savings,
      totalSavings,
      availableAfterLiving,
      futureCommitment,
      automaticSavings,
      overBudget,
      excess: Math.max(0, futureCommitment - availableAfterLiving),
    };
  }

  function getOutflowDraftInputs() {
    return INTEGRATED_CATEGORIES.reduce((inputs, category) => setItemsForCategory(inputs, category, getPersistableDraftItemsForCategory(category)), baselineInputs || getInputs());
  }

  function getCandidateDraftInputs() {
    if (!activeCategory || !baselineInputs) return null;
    if (isOutflowMode()) return getOutflowDraftInputs();
    return setItemsForCategory(baselineInputs, activeCategory, getPersistableDraftItemsForCategory(activeCategory));
  }

  function hasDraftChanges() {
    const candidate = getCandidateDraftInputs();
    return Boolean(candidate && baselineInputs && JSON.stringify(candidate) !== JSON.stringify(baselineInputs));
  }

  function setRowError(category, index, message) {
    const key = getRowKey(category, index);
    if (message) rowErrors = { ...rowErrors, [key]: message };
    else {
      const { [key]: _removed, ...rest } = rowErrors;
      rowErrors = rest;
    }
  }

  function getRowError(category, index) {
    return rowErrors[getRowKey(category, index)] || "";
  }

  function syncRowErrorNode(row, message) {
    if (!row) return;
    let error = row.querySelector("[data-financial-row-error]");
    if (!message) {
      error?.remove();
      return;
    }
    if (!error) {
      error = createText("p", "financial-modal-row__error", "");
      error.dataset.financialRowError = "true";
      const fields = row.querySelector(".financial-modal-row__fields, .financial-variable-detail") || row;
      fields.appendChild(error);
    }
    error.textContent = message;
  }

  function syncVariableRangeSummaryNode() {
    const summary = dom.financialModalRows?.querySelector("[data-financial-variable-range-summary]");
    if (!summary) return;
    const rangeSummary = buildVariableExpenseRangeSummary(getOutflowDraftInputs());
    summary.textContent = `변동비 예상 범위 ${rangeSummary.lowLabel} ~ ${rangeSummary.highLabel}`;
  }

  function validateDraftItem(category, index, item) {
    if (isEmptyTemporaryItem(item)) {
      setRowError(category, index, "");
      return true;
    }
    if (!String(item?.name || "").trim()) {
      setRowError(category, index, "이름을 입력해 주세요.");
      return false;
    }
    if (category !== "account") {
      const amount = Number(item?.amount) || 0;
      if (amount < 0) {
        setRowError(category, index, "금액은 0원 이상이어야 합니다.");
        return false;
      }
      if (amount % 1000 !== 0) {
        setRowError(category, index, "금액은 1,000원 단위로 입력해 주세요.");
        return false;
      }
      if (category === "expense" && isVariableExpenseItem(item)) {
        const varianceAmount = Number(item?.varianceAmount) || 0;
        if (varianceAmount < 0) {
          setRowError(category, index, "금액은 0원 이상이어야 합니다.");
          return false;
        }
        if (varianceAmount % 1000 !== 0) {
          setRowError(category, index, "금액은 1,000원 단위로 입력해 주세요.");
          return false;
        }
      }
    }
    setRowError(category, index, "");
    return true;
  }

  function findFirstInvalidDraftItem() {
    const categories = isOutflowMode() ? INTEGRATED_CATEGORIES : [activeCategory];
    for (const category of categories) {
      const items = getDraftItemsForCategory(category);
      for (let index = 0; index < items.length; index += 1) {
        if (!validateDraftItem(category, index, items[index])) {
          return { category, index };
        }
      }
    }
    return null;
  }

  function appendRailItem(container, label, value, options = {}) {
    const item = document.createElement("div");
    item.className = `financial-detail-rail__item ${options.status ? "financial-detail-rail__item--status" : ""}`;
    if (options.status) item.dataset.financialRailStatus = "true";
    const labelNode = createText("span", "financial-detail-rail__label", label);
    labelNode.dataset.financialRailLabel = "true";
    const valueNode = createText("strong", "financial-detail-rail__value", value);
    item.append(labelNode, valueNode);
    container.appendChild(item);
  }

  function renderSummaryRail() {
    const railState = getRailState();
    const rail = document.createElement("section");
    rail.className = "financial-detail-rail";
    rail.dataset.financialDetailRail = "true";
    rail.setAttribute("aria-label", "월 현금흐름 요약");
    appendRailItem(rail, "수입", IsfUtils.formatMoney(railState.income));
    appendRailItem(rail, "생활비", IsfUtils.formatMoney(railState.living));
    appendRailItem(rail, "투자", IsfUtils.formatMoney(railState.invest));
    appendRailItem(rail, "저축", IsfUtils.formatMoney(railState.totalSavings));

    if (railState.overBudget) {
      const warning = createText("p", "financial-detail-rail__warning", `저축+투자가 생활비 제외 수입보다 ${IsfUtils.formatMoney(railState.excess)} 많습니다.`);
      const action = document.createElement("button");
      action.type = "button";
      action.className = "btn btn-ghost btn-sm";
      action.dataset.financialOverbudgetAction = "true";
      action.textContent = "조정 방식 선택";
      rail.append(warning, action, renderAdjustmentPanel(railState));
    }

    dom.financialModalSummary.replaceChildren(rail);
  }

  function renderAdjustmentPanel(railState = getRailState()) {
    const panel = document.createElement("section");
    panel.className = "financial-adjustment";
    panel.dataset.financialAdjustment = "true";

    const title = createText("h4", "financial-adjustment__title", "자동 저축 보정");
    const copy = createText(
      "p",
      "financial-adjustment__copy",
      `생활비 이후 남는 금액 ${IsfUtils.formatMoney(railState.availableAfterLiving)} 안에서 저축과 투자를 맞춥니다.`,
    );
    const choices = document.createElement("div");
    choices.className = "financial-adjustment__choices";
    ADJUSTMENT_BASIS.forEach(({ key, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `financial-adjustment__choice ${selectedAdjustmentBasis === key ? "is-selected" : ""}`;
      button.dataset.financialAdjustmentChoice = key;
      button.setAttribute("aria-pressed", String(selectedAdjustmentBasis === key));
      button.textContent = label;
      choices.appendChild(button);
    });

    const feedback = createText(
      "p",
      "financial-adjustment__feedback",
      adjustmentFeedback || (selectedAdjustmentBasis ? "선택한 방식은 저장할 때 한 번 적용됩니다." : "저장하려면 조정 방식을 선택하거나 금액을 조정해 초과를 해소해 주세요."),
    );
    feedback.dataset.financialAdjustmentFeedback = "true";
    panel.append(title, copy, choices, feedback);
    return panel;
  }

  function getDraftInputsForActiveCategory() {
    if (isOutflowMode()) {
      return getOutflowDraftInputs();
    }
    return setItemsForCategory(baselineInputs || getInputs(), activeCategory, draftItems);
  }

  function removeHouseholdOverview() {
    dom.financialModal?.querySelector("[data-household-overview]")?.remove();
  }

  function resetDraftsFromBaseline() {
    if (!baselineInputs || !activeCategory) return;
    if (isOutflowCategory(activeCategory)) {
      outflowDrafts = INTEGRATED_CATEGORIES.reduce((drafts, key) => ({
        ...drafts,
        [key]: getItemsForCategory(baselineInputs, key),
      }), {});
      draftItems = getDraftItemsForCategory(activeCategory);
    } else {
      draftItems = getItemsForCategory(baselineInputs, activeCategory);
    }
    createDraft = null;
    createStep = "detail";
    editingIndex = { category: "", index: -1 };
    rowErrors = {};
    selectedAdjustmentBasis = "";
    adjustmentFeedback = "";
    renderRows();
  }

  function pruneEmptyTemporaryRows(category = "") {
    const categories = category ? [category] : (isOutflowMode() ? INTEGRATED_CATEGORIES : [activeCategory]);
    let pruned = false;
    categories.forEach((key) => {
      const items = getDraftItemsForCategory(key);
      const nextItems = items.filter((item) => !isEmptyTemporaryItem(item));
      if (nextItems.length !== items.length) {
        setDraftItemsForCategory(key, nextItems);
        if (editingIndex.category === key && !nextItems[editingIndex.index]) {
          editingIndex = { category: "", index: -1 };
        }
        pruned = true;
      }
    });
    return pruned;
  }

  function foldEditingRow() {
    const previousCategory = editingIndex.category || activeCategory;
    editingIndex = { category: "", index: -1 };
    pruneEmptyTemporaryRows(previousCategory);
  }

  function cancelPendingChanges() {
    resetDraftsFromBaseline();
    syncFinancialModalPendingBar();
  }

  function updateDraftFromField(row, field, value) {
    const category = row.dataset.modalRowCategory || activeCategory;
    const index = Number(row.dataset.modalRowIndex);
    const items = getDraftItemsForCategory(category);
    const item = items[index];
    if (!item) return;

    const nextItem = { ...item };
    if (field === "name") nextItem.name = String(value || "").slice(0, 32);
    if (field === "amount" || (field === "varianceAmount" && category === "expense" && isVariableExpenseItem(item))) {
      const normalized = normalizeMoneyValue(value);
      nextItem[field] = normalized.value;
      if (category === "income" && field === "amount") {
        nextItem.allocations = [{ accountId: nextItem.accountId, amount: normalized.value }];
      }
      setRowError(category, index, normalized.error);
      syncRowErrorNode(row, normalized.error);
      if (normalized.error && String(value || "").trim().startsWith("-")) {
        const input = row.querySelector(`[data-financial-modal-field="${field}"]`);
        if (input) input.value = formatMoneyInput(0);
      }
    }
    if (field === "actualSpent" && category === "expense" && isVariableExpenseItem(item)) {
      nextItem.actualSpent = IsfUtils.toWon(value || "0");
    }
    if (field === "group") nextItem.group = normalizeAllocationGroupName(value || "");
    if (field === "groupMode") {
      if (value === "__custom__") {
        customGroupIndexes.add(index);
        if (buildGroupOptions(draftItems, activeCategory).includes(item.group)) nextItem.group = "";
        items[index] = nextItem;
        setDraftItemsForCategory(category, items);
        renderRows();
      } else {
        customGroupIndexes.delete(index);
        nextItem.group = normalizeAllocationGroupName(value || "");
        items[index] = nextItem;
        setDraftItemsForCategory(category, items);
        renderRows();
      }
      return;
    }
    if (field === "accountId") {
      nextItem.accountId = value;
      if (category === "income") {
        nextItem.allocations = [{ accountId: value, amount: Number(nextItem.amount) || 0 }];
      }
    }
    if (field === "annualRate") {
      const parsed = parseSavingsAnnualRateInput(value || "", getInputs().annualSavingsYield);
      if (parsed === null) delete nextItem.annualRate;
      else nextItem.annualRate = parsed;
    }
    if (field === "maturityMonth") {
      if (value) nextItem.maturityMonth = value;
      else delete nextItem.maturityMonth;
    }
    items[index] = nextItem;
    setDraftItemsForCategory(category, items);
    adjustmentFeedback = "";
    syncStats();
    if (category === "expense" && (field === "amount" || field === "varianceAmount")) {
      syncVariableRangeSummaryNode();
    }
    syncFinancialModalPendingBar();
  }

  function renderCompactRow(item, index, accounts, rowCategory = activeCategory) {
    const row = document.createElement("article");
    row.className = "financial-modal-row";
    row.dataset.modalRowCategory = rowCategory;
    row.dataset.modalRowIndex = String(index);
    if (isOutflowMode()) {
      row.draggable = true;
      row.dataset.draggableOutflowItem = "true";
    }

    const header = document.createElement("div");
    header.className = "financial-modal-row__header";
    header.appendChild(createText("strong", "", getItemLabel(item, rowCategory, index)));
    row.appendChild(header);

    const summary = document.createElement("div");
    summary.className = "financial-modal-row__summary";
    if (rowCategory === "account") {
      summary.appendChild(createText("span", "", "계좌 별칭"));
    } else {
      summary.appendChild(createText("span", "", IsfUtils.formatMoney(Number(item.amount) || 0)));
    }
    row.appendChild(summary);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn-ghost btn-sm financial-modal-row__edit";
    edit.dataset.financialModalEdit = String(index);
    edit.dataset.financialModalCategory = rowCategory;
    edit.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    row.appendChild(edit);

    return row;
  }

  function appendMoneyControls(label, input, options = {}) {
    const wrap = document.createElement("div");
    wrap.className = "financial-money-control";
    wrap.appendChild(input);

    const steppers = document.createElement("div");
    steppers.className = "financial-money-control__steppers";
    [
      ["down", "-"],
      ["up", "+"],
    ].forEach(([direction, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-ghost btn-sm";
      button.dataset.moneyStep = direction;
      button.dataset.moneyField = input.dataset.financialModalField || "amount";
      button.setAttribute("aria-label", `${label} ${text} 1만원`);
      button.textContent = text;
      steppers.appendChild(button);
    });

    const quicks = document.createElement("div");
    quicks.className = "quick-amount-buttons";
    const quickValues = options.variance
      ? [["10000", "±1만"], ["50000", "±5만"], ["100000", "±10만"]]
      : [["50000", "+5만"], ["100000", "+10만"], ["1000000", "+100만"]];
    quickValues.forEach(([value, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn-quick-amount";
      button.dataset.moneyField = input.dataset.financialModalField || "amount";
      if (options.variance) button.dataset.varianceQuick = value;
      else button.dataset.moneyQuick = value;
      button.textContent = text;
      quicks.appendChild(button);
    });

    wrap.append(steppers, quicks);
    return wrap;
  }

  function createMoneyInput(field, amount) {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.value = formatMoneyInput(amount);
    input.dataset.moneyInput = "won";
    input.dataset.financialModalField = field;
    return input;
  }

  function renderEditingRow(item, index, accounts, rowCategory = activeCategory) {
    const row = renderCompactRow(item, index, accounts, rowCategory);
    row.classList.add("financial-modal-row--editing");

    const fields = document.createElement("div");
    fields.className = "financial-modal-row__fields";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = item.name || "";
    nameInput.dataset.financialModalField = "name";
    appendField(fields, rowCategory === "account" ? "계좌 별칭" : "비용 이름", nameInput);

    if (rowCategory !== "account") {
      const selectedAccountId = item.accountId || recommendAccountId(getInputs(), rowCategory, item);
      item.accountId = selectedAccountId;
      const amountInput = createMoneyInput("amount", item.amount);
      appendField(fields, "금액", appendMoneyControls("금액", amountInput));
      appendField(fields, "출처 계좌", createAccountSelect(accounts, selectedAccountId, "accountId"));

      if (rowCategory === "expense" && isVariableExpenseItem(item)) {
        const varianceInput = createMoneyInput("varianceAmount", item.varianceAmount);
        appendField(fields, "±범위", appendMoneyControls("범위", varianceInput, { variance: true }));
      }
    }

    const errorMessage = getRowError(rowCategory, index);
    if (errorMessage) {
      const error = createText("p", "financial-modal-row__error", errorMessage);
      error.dataset.financialRowError = "true";
      fields.appendChild(error);
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-ghost btn-sm financial-modal-row__remove";
    remove.dataset.financialModalRemove = String(index);
    remove.dataset.financialModalCategory = rowCategory;
    remove.textContent = "삭제";

    row.append(fields, remove);
    return row;
  }

  function renderRow(item, index, accounts, rowCategory = activeCategory) {
    const editingCategory = editingIndex.category || activeCategory;
    const editingItemIndex = Number.isFinite(editingIndex.index) ? editingIndex.index : editingIndex;
    return editingCategory === rowCategory && editingItemIndex === index
      ? renderEditingRow(item, index, accounts, rowCategory)
      : renderCompactRow(item, index, accounts, rowCategory);
  }

  function formatRemainingLabel(row) {
    return `${row.remaining < 0 ? "-" : ""}${row.remainingLabel}`;
  }

  function appendVariableMetric(container, label, value) {
    const metric = document.createElement("div");
    metric.className = "financial-variable-row__metric";
    metric.append(createText("span", "", label), createText("strong", "", value));
    container.appendChild(metric);
  }

  function renderVariableExpenseRow(row) {
    const sourceIndex = Number(row.sourceIndex);
    const isSelected = editingIndex.category === "expense" && editingIndex.index === sourceIndex;
    const sourceItem = getDraftItemsForCategory("expense")[sourceIndex] || {};
    const article = document.createElement("article");
    article.className = `financial-variable-row ${isSelected ? "financial-variable-row--expanded" : ""}`;
    article.dataset.financialVariableRow = row.id || String(sourceIndex);
    article.dataset.modalRowCategory = "expense";
    article.dataset.modalRowIndex = String(sourceIndex);

    const header = document.createElement("div");
    header.className = "financial-variable-row__header";
    header.appendChild(createText("strong", "", row.name));

    const summary = document.createElement("div");
    summary.className = "financial-variable-row__summary";
    appendVariableMetric(summary, "평균", row.targetLabel);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn-ghost btn-sm financial-variable-row__edit";
    edit.dataset.financialModalEdit = String(sourceIndex);
    edit.dataset.financialModalCategory = "expense";
    edit.textContent = isSelected ? "접기" : "수정";

    article.append(header, summary, edit);

    if (isSelected) {
      const detail = document.createElement("div");
      detail.className = "financial-variable-detail";
      detail.dataset.financialVariableDetail = row.id || String(sourceIndex);

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = sourceItem.name || "";
      nameInput.dataset.financialModalField = "name";
      appendField(detail, "비용 이름", nameInput);

      const targetInput = createMoneyInput("amount", row.target);
      appendField(detail, "평균 금액", appendMoneyControls("평균 금액", targetInput));

      const varianceInput = createMoneyInput("varianceAmount", row.varianceAmount);
      appendField(detail, "±범위", appendMoneyControls("범위", varianceInput, { variance: true }));

      const selectedAccountId = sourceItem.accountId || recommendAccountId(getInputs(), "expense", sourceItem);
      sourceItem.accountId = selectedAccountId;
      appendField(detail, "출금 계좌", createAccountSelect(getInputs().accounts, selectedAccountId, "accountId"));

      const errorMessage = getRowError("expense", sourceIndex);
      if (errorMessage) {
        const error = createText("p", "financial-modal-row__error", errorMessage);
        error.dataset.financialRowError = "true";
        detail.appendChild(error);
      }
      article.appendChild(detail);
    }

    return article;
  }

  function renderOutflowTabs() {
    const tabs = document.createElement("div");
    tabs.className = "financial-modal-tabs financial-detail-tabs";
    tabs.dataset.financialDetailTabs = "true";
    tabs.setAttribute("role", "tablist");
    DETAIL_TABS.forEach(({ key, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `financial-modal-tab ${activeOutflowTab === key ? "is-active" : ""}`;
      button.dataset.outflowTab = key;
      button.dataset.financialDetailTab = "true";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(activeOutflowTab === key));
      button.textContent = label;
      tabs.appendChild(button);
    });
    return tabs;
  }

  function renderLivingExpensePanel(panel, accounts) {
    const livingTotal = sumDraftCategory("expense");
    panel.appendChild(createText("p", "financial-detail-panel__lead", `월 생활비 목표 합계는 ${IsfUtils.formatMoney(livingTotal)}입니다.`));

    const rangeSummary = buildVariableExpenseRangeSummary(getOutflowDraftInputs());
    if (rangeSummary.count > 0) {
      const summary = createText(
        "p",
        "financial-variable-range-summary",
        `변동비 예상 범위 ${rangeSummary.lowLabel} ~ ${rangeSummary.highLabel}`,
      );
      summary.dataset.financialVariableRangeSummary = "true";
      panel.appendChild(summary);
    }

    const variableSection = document.createElement("section");
    variableSection.className = "financial-variable-section";
    variableSection.appendChild(createText("h4", "financial-variable-section__title", "변동비"));
    const rows = buildVariableExpenseBudgetRows(getOutflowDraftInputs());
    if (rows.length === 0) {
      const empty = createText("p", "financial-variable-empty", "변동비 항목이 없습니다. 새 항목 추가에서 변동비를 만들 수 있습니다.");
      empty.dataset.financialVariableEmpty = "true";
      variableSection.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "financial-variable-list";
      rows.forEach((row) => list.appendChild(renderVariableExpenseRow(row)));
      variableSection.appendChild(list);
    }
    panel.appendChild(variableSection);

    const fixedItems = getDraftItemsForCategory("expense")
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !isVariableExpenseItem(item));
    if (fixedItems.length > 0) {
      const fixedSection = document.createElement("section");
      fixedSection.className = "financial-fixed-section";
      fixedSection.appendChild(createText("h4", "financial-variable-section__title", "고정비"));
      const fixedList = document.createElement("div");
      fixedList.className = "financial-variable-list";
      fixedItems.forEach(({ item, index }) => {
        const row = renderRow(item, index, accounts, "expense");
        row.dataset.financialFixedRow = item.id || String(index);
        fixedList.appendChild(row);
      });
      fixedSection.appendChild(fixedList);
      panel.appendChild(fixedSection);
    }
  }

  function getActiveAddLabel() {
    const activeTab = DETAIL_TABS.find((tab) => tab.key === activeOutflowTab);
    const createCategory = activeTab?.createCategory || getCreateCategory();
    if (activeOutflowTab === "living") return "생활비 추가";
    if (createCategory === "income") return "수입 추가";
    if (createCategory === "invest") return "투자 추가";
    if (createCategory === "savings") return "저축 추가";
    if (createCategory === "expense") return "생활비 추가";
    return createCategory === "account" ? "계좌 추가" : "항목 추가";
  }

  function appendPanelHeader(panel) {
    if (activeOutflowTab === "result") return;
    const header = document.createElement("div");
    header.className = "financial-detail-panel__head";
    const title = createText(
      "h3",
      "financial-detail-panel__heading",
      DETAIL_TABS.find((tab) => tab.key === activeOutflowTab)?.label || CATEGORY_CONFIG[getCreateCategory()]?.label || "항목",
    );
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn-ghost btn-sm";
    add.dataset.financialInlineAdd = "true";
    add.textContent = getActiveAddLabel();
    header.append(title, add);
    panel.appendChild(header);
  }

  function renderGroupSection(category, groupName, accounts) {
    const section = document.createElement("section");
    section.className = "financial-group-section";
    section.dataset.groupDropCategory = category;
    section.dataset.groupDropName = groupName;

    const header = document.createElement("div");
    header.className = "financial-group-section__head";
    header.append(
      createText("strong", "", groupName),
      createText("span", "", CATEGORY_CONFIG[category]?.label || ""),
    );

    const items = getDraftItemsForCategory(category);
    const body = document.createElement("div");
    body.className = "financial-group-section__items";
    const grouped = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => normalizeAllocationGroupName(item.group || CATEGORY_CONFIG[category].label) === groupName);

    if (grouped.length === 0) {
      body.appendChild(createText("p", "financial-group-section__empty", "이 그룹으로 항목을 끌어오세요."));
    } else {
      grouped.forEach(({ item, index }) => body.appendChild(renderRow(item, index, accounts, category)));
    }

    section.append(header, body);
    return section;
  }

  function renderCombinedFutureGroupSection(groupName, accounts) {
    const section = document.createElement("section");
    section.className = "financial-group-section";
    section.dataset.groupDropScope = "future";
    section.dataset.groupDropName = groupName;

    const header = document.createElement("div");
    header.className = "financial-group-section__head";
    header.appendChild(createText("strong", "", groupName));

    const body = document.createElement("div");
    body.className = "financial-group-section__items";
    const grouped = getRenderedCategories().flatMap((category) => (
      getDraftItemsForCategory(category)
        .map((item, index) => ({ category, item, index }))
        .filter(({ item }) => getFutureDisplayGroup(item) === groupName)
    ));

    if (grouped.length === 0) {
      body.appendChild(createText("p", "financial-group-section__empty", "이 그룹으로 저축/투자 항목을 끌어오세요."));
    } else {
      grouped.forEach(({ category, item, index }) => body.appendChild(renderRow(item, index, accounts, category)));
    }

    section.append(header, body);
    return section;
  }

  function renderOutflowRows(accounts) {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(renderOutflowTabs());

    const activeTab = DETAIL_TABS.find((tab) => tab.key === activeOutflowTab) || DETAIL_TABS[0];
    const panel = document.createElement("section");
    panel.className = "financial-detail-panel";
    panel.dataset.financialDetailPanel = "true";

    if (activeOutflowTab === "result") {
      const state = getRailState();
      const result = document.createElement("section");
      result.className = "financial-result";
      result.dataset.financialAutomaticSavingsResult = "true";
      result.append(
        createText("span", "financial-result__label", "자동 저축"),
        createText("strong", "financial-result__value", IsfUtils.formatMoney(state.automaticSavings)),
        createText("p", "financial-result__copy", "월 수입에서 생활비, 저축, 투자를 반영한 뒤 남는 금액입니다."),
      );
      panel.appendChild(result);
      const savingsNav = document.createElement("button");
      savingsNav.type = "button";
      savingsNav.className = "btn btn-ghost btn-sm";
      savingsNav.dataset.outflowTab = "savings";
      savingsNav.dataset.financialResultSavingsAction = "true";
      savingsNav.textContent = "저축 항목 보기";
      panel.appendChild(savingsNav);
      fragment.appendChild(panel);
      dom.financialModalRows.replaceChildren(fragment);
      return;
    }

    appendPanelHeader(panel);

    if (activeOutflowTab === "living") {
      renderLivingExpensePanel(panel, accounts);
      fragment.appendChild(panel);
      dom.financialModalRows.replaceChildren(fragment);
      return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "financial-group-toolbar";
    const addGroup = document.createElement("button");
    addGroup.type = "button";
    addGroup.className = "btn btn-ghost btn-sm";
    addGroup.dataset.financialAddGroup = "true";
    addGroup.textContent = "그룹 추가";
    toolbar.appendChild(addGroup);
    panel.appendChild(toolbar);

    const groups = document.createElement("div");
    groups.className = "financial-group-board";
    getRenderedCategories().forEach((category) => {
      getGroupNames(category).forEach((groupName) => {
        groups.appendChild(renderGroupSection(category, groupName, accounts));
      });
    });
    panel.appendChild(groups);
    fragment.appendChild(panel);
    dom.financialModalRows.replaceChildren(fragment);
  }

  function addGroupToActiveTab() {
    const category = getCreateCategory();
    const rawName = window.prompt("새 그룹명을 입력해 주세요.");
    const name = normalizeAllocationGroupName(rawName || "");
    if (!name) return;
      customGroupNames = {
        ...customGroupNames,
        [category]: Array.from(new Set([...safeItems(customGroupNames[category]), name])),
      };
    renderRows();
  }

  function moveItemToGroup(category, index, groupName) {
    const normalizedGroup = normalizeAllocationGroupName(groupName || "");
    const items = getDraftItemsForCategory(category).map((item, itemIndex) => (
      itemIndex === index ? { ...item, group: normalizedGroup } : item
    ));
    setDraftItemsForCategory(category, items);
    editingIndex = { category: "", index: -1 };
    renderRows();
  }

  function removeItem(category, index) {
    const item = getDraftItemsForCategory(category)[index];
    if (!item) return;
    const items = getDraftItemsForCategory(category).filter((_, itemIndex) => itemIndex !== index);
    setDraftItemsForCategory(category, items);
    editingIndex = { category: "", index: -1 };
    renderRows();
  }

  function renderRows() {
    if (!dom.financialModalRows) return;
    if (createDraft) {
      renderCreateStep();
      return;
    }
    const accounts = safeItems(getInputs().accounts);
    if (isOutflowMode()) {
      renderOutflowRows(accounts);
    } else {
      dom.financialModalRows.replaceChildren(...draftItems.map((item, index) => renderRow(item, index, accounts)));
    }
    syncStats();
    IsfUtils.updateAllKoreanWonHints(dom.financialModalRows);
    syncFinancialModalPendingBar();
  }

  function reduceItemsByAmount(items, amountToReduce) {
    let remaining = Math.max(0, Number(amountToReduce) || 0);
    return safeItems(items).map((item) => {
      const current = Number(item.amount) || 0;
      const reduction = Math.min(current, remaining);
      remaining -= reduction;
      return {
        ...item,
        amount: current - reduction,
      };
    });
  }

  function scaleItemsToTotal(items, targetTotal) {
    const safe = safeItems(items);
    const currentTotal = safe.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const safeTarget = Math.max(0, Number(targetTotal) || 0);
    if (currentTotal <= 0) {
      return safe.map((item) => ({ ...item, amount: 0 }));
    }
    let assigned = 0;
    return safe.map((item, index) => {
      const isLast = index === safe.length - 1;
      const amount = isLast
        ? Math.max(0, safeTarget - assigned)
        : Math.max(0, Math.round(((Number(item.amount) || 0) * safeTarget) / currentTotal / 1000) * 1000);
      assigned += amount;
      return {
        ...item,
        amount,
      };
    });
  }

  function applySelectedAdjustment(nextInputs) {
    const state = getRailState();
    if (!state.overBudget || !selectedAdjustmentBasis) return nextInputs;
    const savingsItems = getDraftItemsForCategory("savings");
    const investItems = getDraftItemsForCategory("invest");
    const savingsTotal = state.savings;
    const investTotal = state.invest;

    if (selectedAdjustmentBasis === "invest-first") {
      const adjustedInvest = reduceItemsByAmount(investItems, state.excess);
      const remainingExcess = Math.max(0, state.excess - investTotal);
      const adjustedSavings = remainingExcess > 0 ? reduceItemsByAmount(savingsItems, remainingExcess) : savingsItems;
      return setItemsForCategory(setItemsForCategory(nextInputs, "invest", adjustedInvest), "savings", adjustedSavings);
    }

    if (selectedAdjustmentBasis === "savings-first") {
      const adjustedSavings = reduceItemsByAmount(savingsItems, state.excess);
      const remainingExcess = Math.max(0, state.excess - savingsTotal);
      const adjustedInvest = remainingExcess > 0 ? reduceItemsByAmount(investItems, remainingExcess) : investItems;
      return setItemsForCategory(setItemsForCategory(nextInputs, "savings", adjustedSavings), "invest", adjustedInvest);
    }

    const targetTotal = state.availableAfterLiving;
    const adjustedSavingsTotal = Math.round((targetTotal * savingsTotal) / Math.max(1, state.futureCommitment) / 1000) * 1000;
    const adjustedInvestTotal = Math.max(0, targetTotal - adjustedSavingsTotal);
    return setItemsForCategory(
      setItemsForCategory(nextInputs, "savings", scaleItemsToTotal(savingsItems, adjustedSavingsTotal)),
      "invest",
      scaleItemsToTotal(investItems, adjustedInvestTotal),
    );
  }

  function open(category = "expense") {
    const config = CATEGORY_CONFIG[category];
    if (!config || !dom.financialModal) return;
    activeCategory = category;
    baselineInputs = clone(getInputs());
    if (isOutflowCategory(category)) {
      outflowDrafts = INTEGRATED_CATEGORIES.reduce((drafts, key) => ({
        ...drafts,
        [key]: getItemsForCategory(baselineInputs, key),
      }), {});
      draftItems = getDraftItemsForCategory(category);
      activeOutflowTab = category === "expense" ? "living" : category;
      customGroupNames = INTEGRATED_CATEGORIES.reduce((groups, key) => ({
        ...groups,
        [key]: buildGroupOptions(getDraftItemsForCategory(key), key),
      }), {});
    } else {
      outflowDrafts = null;
      draftItems = getItemsForCategory(baselineInputs, category);
      customGroupNames = {};
    }
    createDraft = null;
    createStep = "detail";
    editingIndex = { category, index: -1 };
    customGroupIndexes = new Set();
    householdContextChanged = false;
    selectedAdjustmentBasis = "";
    adjustmentFeedback = "";

    if (dom.financialModalTitle) {
      dom.financialModalTitle.textContent = "재무설정 상세";
    }
    if (dom.financialModalDescription) {
      dom.financialModalDescription.textContent = isOutflowCategory(category)
        ? "월 수입부터 자동 저축 결과까지 한 흐름에서 확인합니다. 변경 내용은 저장할 때만 요약 화면에 반영됩니다."
        : category === "account"
        ? "계좌 별칭만 가볍게 정리합니다. 별도 계좌 관리 화면은 만들지 않습니다."
        : "항목 이름, 금액, 연결 계좌를 확인하고 저장할 때만 요약 화면에 반영합니다.";
    }
    renderRows();
    if (dom.financialModalSave) {
      dom.financialModalSave.hidden = false;
      dom.financialModalSave.textContent = "적용";
    }
    if (dom.financialModalCancel) {
      dom.financialModalCancel.textContent = "취소";
    }
    if (dom.financialModalCreate) {
      dom.financialModalCreate.hidden = isOutflowCategory(category);
      dom.financialModalCreate.textContent = category === "account" ? "새 계좌 추가" : "새 항목 추가";
    }
    dom.financialModal.hidden = false;
    window.setTimeout(() => dom.financialModal.classList.add("is-active"), 10);
    syncFinancialModalPendingBar();
  }

  function close({ force = false } = {}) {
    if (!dom.financialModal) return;
    if (!force && hasDraftChanges() && !window.confirm(CLOSE_CONFIRM_MESSAGE)) {
      syncFinancialModalPendingBar();
      return;
    }
    dom.financialModal.classList.remove("is-active");
    activeCategory = "";
    baselineInputs = null;
    draftItems = [];
    outflowDrafts = null;
    createDraft = null;
    createStep = "detail";
    editingIndex = { category: "", index: -1 };
    customGroupNames = {};
    customGroupIndexes = new Set();
    householdContextChanged = false;
    selectedAdjustmentBasis = "";
    adjustmentFeedback = "";
    removeHouseholdOverview();
    window.setTimeout(() => {
      dom.financialModal.hidden = true;
    }, 250);
    syncFinancialModalPendingBar();
  }

  function save() {
    if (!activeCategory || !baselineInputs) return;
    const validationError = findFirstInvalidDraftItem();
    if (validationError) {
      editingIndex = { category: validationError.category, index: validationError.index };
      renderRows();
      syncFinancialModalPendingBar();
      return;
    }
    const railState = isOutflowMode() ? getRailState() : null;
    if (railState?.overBudget && !selectedAdjustmentBasis) {
      adjustmentFeedback = "조정 방식을 선택하거나 금액을 조정해 초과를 해소해 주세요.";
      renderRows();
      return;
    }
    const nextInputsBase = isOutflowMode()
      ? INTEGRATED_CATEGORIES.reduce((inputs, category) => setItemsForCategory(inputs, category, getPersistableDraftItemsForCategory(category)), baselineInputs)
      : setItemsForCategory(baselineInputs, activeCategory, getPersistableDraftItemsForCategory(activeCategory));
    const nextInputs = isOutflowMode() ? applySelectedAdjustment(nextInputsBase) : nextInputsBase;
    if (persistence && typeof persistence.commitImmediateInputs === "function") {
      persistence.commitImmediateInputs(nextInputs);
    } else if (typeof renderAll === "function") {
      renderAll();
    }
    baselineInputs = clone(nextInputs);
    rowErrors = {};
    householdContextChanged = false;
    resetDraftsFromBaseline();
    syncFinancialModalPendingBar();
    if (dom.financialModalPendingBar) {
      dom.financialModalPendingBar.hidden = true;
      dom.financialModalPendingBar.style.display = "none";
    }
  }

  function handleAdjustmentClick(target) {
    const adjustmentChoice = target.closest?.("[data-financial-adjustment-choice]");
    if (adjustmentChoice) {
      selectedAdjustmentBasis = adjustmentChoice.dataset.financialAdjustmentChoice || "";
      adjustmentFeedback = "선택한 방식은 저장할 때 한 번 적용됩니다.";
      renderRows();
      return true;
    }
    if (target.closest?.("[data-financial-overbudget-action]")) {
      activeOutflowTab = "result";
      renderRows();
      return true;
    }
    return false;
  }

  function adjustMoneyField(row, field, delta) {
    if (!row) return;
    const category = row.dataset.modalRowCategory || activeCategory;
    const index = Number(row.dataset.modalRowIndex);
    const items = getDraftItemsForCategory(category);
    const item = items[index];
    if (!item) return;
    const nextValue = Math.max(0, (Number(item[field]) || 0) + delta);
    const nextItem = { ...item, [field]: nextValue };
    if (category === "income" && field === "amount") {
      nextItem.allocations = [{ accountId: nextItem.accountId, amount: nextValue }];
    }
    items[index] = nextItem;
    setRowError(category, index, "");
    setDraftItemsForCategory(category, items);
    const input = row.querySelector(`[data-financial-modal-field="${field}"]`);
    if (input) input.value = formatMoneyInput(nextValue);
    adjustmentFeedback = "";
    syncStats();
    if (category === "expense" && (field === "amount" || field === "varianceAmount")) {
      syncVariableRangeSummaryNode();
    }
    syncFinancialModalPendingBar();
  }

  function getRecommendedAccountId() {
    const inputs = getInputs();
    return recommendAccountId(inputs, getCreateCategory(), {});
  }

  function buildTemporaryItem(category) {
    const accountId = category === "account" ? "" : getRecommendedAccountId();
    const item = {
      __temporary: true,
      id: `tmp-${category}-${Date.now()}`,
      name: "",
      amount: 0,
      accountId,
    };
    if (category === "income") {
      item.tone = "income";
      item.allocations = [{ accountId, amount: 0 }];
    } else if (category !== "account") {
      item.group = getGroupNames(category)[0] || CATEGORY_CONFIG[category]?.label || "";
      item.tone = category;
    }
    return item;
  }

  function startInlineCreateRow() {
    const createCategory = getCreateCategory();
    const items = getDraftItemsForCategory(createCategory);
    const nextItems = [...items, buildTemporaryItem(createCategory)];
    setDraftItemsForCategory(createCategory, nextItems);
    editingIndex = { category: createCategory, index: nextItems.length - 1 };
    createDraft = null;
    createStep = "detail";
    renderRows();
  }

  function startCreateFlow() {
    startInlineCreateRow();
  }

  function makeCreateField(labelText, control) {
    const label = document.createElement("label");
    label.className = "financial-create-field";
    label.appendChild(createText("span", "financial-modal-field__label", labelText));
    label.appendChild(control);
    return label;
  }

  function createInput(field, value = "", options = {}) {
    const input = document.createElement("input");
    input.type = options.type || "text";
    input.value = value;
    if (options.inputMode) input.inputMode = options.inputMode;
    if (options.step) input.step = options.step;
    input.dataset.createField = field;
    return input;
  }

  function renderCreateDetails() {
    const step = document.createElement("section");
    step.className = "financial-create-step";
    step.dataset.createStep = "details";

    const createCategory = createDraft.category || getCreateCategory();
    const title = createText("h3", "financial-create-step__title", `${CATEGORY_CONFIG[createCategory].label} 추가`);
    const grid = document.createElement("div");
    grid.className = "financial-create-grid";

    grid.appendChild(makeCreateField(
      createCategory === "account" ? "계좌 별칭" : "비용 이름",
      createInput("name", createDraft.name),
    ));

    if (createCategory !== "account") {
      const accountSelect = createAccountSelect(getInputs().accounts, createDraft.accountId, "accountId");
      accountSelect.id = "financialCreateAccountSelect";
      grid.appendChild(makeCreateField("출처 계좌", accountSelect));

      grid.appendChild(makeCreateField(
        "금액",
        createInput("amount", createDraft.amount ? formatAmount(createDraft.amount) : "", { inputMode: "decimal" }),
      ));

      if (!isOutflowMode()) {
        const groupInput = createInput("group", createDraft.group || CATEGORY_CONFIG[createCategory].label);
        grid.appendChild(makeCreateField("그룹", groupInput));

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.id = "financialCreateNewAccountToggle";
        toggle.className = `btn btn-ghost btn-sm ${createDraft.useNewAccount ? "is-active" : ""}`;
        toggle.textContent = createDraft.useNewAccount ? "기존 계좌 선택으로 돌아가기" : "새 계좌 만들기";
        step.appendChild(toggle);

        if (createDraft.useNewAccount) {
          const accountName = createInput("accountName", createDraft.accountName);
          step.appendChild(makeCreateField("새 계좌 이름", accountName));
        }
      }
    }

    const actions = document.createElement("div");
    actions.className = "financial-create-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-ghost btn-sm";
    cancel.id = "financialCreateCancel";
    cancel.textContent = "취소";
    const review = document.createElement("button");
    review.type = "button";
    review.className = "btn btn-primary btn-sm";
    review.id = "financialCreateReview";
    review.textContent = "다음: 확인";
    actions.append(cancel, review);

    step.prepend(title, grid);
    step.appendChild(actions);
    dom.financialModalRows.replaceChildren(step);
    syncStats();
    IsfUtils.updateAllKoreanWonHints(dom.financialModalRows);
  }

  function readCreateFields() {
    if (!dom.financialModalRows || !createDraft) return;
    dom.financialModalRows.querySelectorAll("[data-create-field]").forEach((field) => {
      const key = field.dataset.createField;
      if (key === "amount") createDraft.amount = IsfUtils.toWon(field.value || "0");
      else createDraft[key] = field.value || "";
    });
    const accountSelect = dom.financialModalRows.querySelector("#financialCreateAccountSelect");
    if (accountSelect && !createDraft.useNewAccount) {
      createDraft.accountId = accountSelect.value;
    }
  }

  function validateCreateDraft() {
    readCreateFields();
    const createCategory = createDraft?.category || getCreateCategory();
    if (!String(createDraft?.name || "").trim()) return "이름을 입력해 주세요.";
    if (createCategory !== "account") {
      if ((Number(createDraft.amount) || 0) < 1000) return "금액은 최소 1,000원 이상이어야 합니다.";
      if ((Number(createDraft.amount) || 0) % 1000 !== 0) return "금액은 1,000원 단위로 입력해 주세요.";
      if (createDraft.useNewAccount && !String(createDraft.accountName || "").trim()) {
        return "새 계좌 이름을 입력해 주세요.";
      }
      if (!createDraft.useNewAccount && !createDraft.accountId) return "연결 계좌를 선택해 주세요.";
    }
    return "";
  }

  function getCreateAccountName() {
    if (createDraft.useNewAccount) return createDraft.accountName;
    return getAccountName(getInputs().accounts, createDraft.accountId);
  }

  function renderCreateConfirm() {
    const message = validateCreateDraft();
    if (message) {
      window.alert(message);
      return;
    }
    createStep = "confirm";
    const createCategory = createDraft.category || getCreateCategory();

    const confirm = document.createElement("section");
    confirm.className = "financial-create-confirm";
    confirm.id = "financialCreateConfirm";
    confirm.dataset.createStep = "confirm";

    const title = createText("h3", "financial-create-step__title", "최종 확인");
    const rows = document.createElement("div");
    rows.className = "financial-create-confirm__rows";

    const summaryRows = [
      ["항목", createDraft.name],
      ["금액", createCategory === "account" ? "계좌 별칭" : IsfUtils.convertToKoreanWon(createDraft.amount)],
      ["연결 계좌", createCategory === "account" ? createDraft.name : getCreateAccountName()],
      ["그룹/유형", createCategory === "account" ? "계좌" : `${CATEGORY_CONFIG[createCategory].label} · ${createDraft.group || CATEGORY_CONFIG[createCategory].label}`],
    ];
    if (!isOutflowMode()) {
      summaryRows.push(["보정", createDraft.useNewAccount ? "새 계좌 생성 후 연결" : "자동 보정 없음"]);
    }
    summaryRows.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "financial-create-confirm__row";
      row.append(createText("span", "", label), createText("strong", "", value));
      rows.appendChild(row);
    });

    const actions = document.createElement("div");
    actions.className = "financial-create-actions";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn btn-ghost btn-sm";
    back.id = "financialCreateBack";
    back.textContent = "이전";
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "btn btn-primary btn-sm";
    saveButton.id = "financialCreateSave";
    saveButton.textContent = "저장";
    actions.append(back, saveButton);

    confirm.append(title, rows, actions);
    dom.financialModalRows.replaceChildren(confirm);
  }

  function buildCreatedAccount(nextInputs) {
    const createCategory = createDraft.category || getCreateCategory();
    if (!createDraft.useNewAccount || createCategory === "account") return null;
    const safeName = String(createDraft.accountName || "").trim();
    if (!safeName) return null;
    const idBase = safeName
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "") || "account";
    let candidateId = `acc-${idBase}`;
    let suffix = 1;
    const accountIds = new Set(safeItems(nextInputs.accounts).map((account) => account.id));
    while (accountIds.has(candidateId)) {
      candidateId = `acc-${idBase}-${suffix}`;
      suffix += 1;
    }
    return { id: candidateId, name: safeName };
  }

  function commitCreateDraft() {
    const message = validateCreateDraft();
    if (message) {
      window.alert(message);
      return;
    }
    const base = clone(baselineInputs || getInputs());
    const createCategory = createDraft.category || getCreateCategory();
    if (isOutflowMode()) {
      const newItem = {
        id: `${createCategory}-${Date.now()}`,
        name: String(createDraft.name || "").trim(),
        amount: Number(createDraft.amount) || 0,
        group: normalizeAllocationGroupName(createDraft.group || getGroupNames(createCategory)[0] || CATEGORY_CONFIG[createCategory].label),
        accountId: createDraft.accountId,
        tone: createCategory,
      };
      setDraftItemsForCategory(createCategory, [...getDraftItemsForCategory(createCategory), newItem]);
      createDraft = null;
      createStep = "detail";
      if (dom.financialModalSave) dom.financialModalSave.hidden = false;
      if (dom.financialModalCreate) dom.financialModalCreate.hidden = false;
      renderRows();
      return;
    }
    let nextInputs = {
      ...base,
      accounts: safeItems(base.accounts).map((account) => ({ ...account })),
    };

    if (createCategory === "account") {
      const account = {
        id: `acc-${Date.now()}`,
        name: String(createDraft.name || "").trim(),
      };
      nextInputs.accounts = [...nextInputs.accounts, account];
    } else {
      const createdAccount = buildCreatedAccount(nextInputs);
      const accountId = createdAccount ? createdAccount.id : createDraft.accountId;
      if (createdAccount) nextInputs.accounts = [...nextInputs.accounts, createdAccount];

      const newItem = {
        id: `${createCategory}-${Date.now()}`,
        name: String(createDraft.name || "").trim(),
        amount: Number(createDraft.amount) || 0,
        group: normalizeAllocationGroupName(createDraft.group || CATEGORY_CONFIG[createCategory].label),
        accountId,
      };
      if (createCategory === "income") {
        delete newItem.group;
        newItem.tone = "income";
        newItem.allocations = [{ accountId, amount: newItem.amount }];
      } else {
        newItem.tone = createCategory;
      }

      nextInputs = setItemsForCategory(nextInputs, createCategory, [
        ...getItemsForCategory(nextInputs, createCategory),
        newItem,
      ]);
    }

    if (persistence && typeof persistence.commitImmediateInputs === "function") {
      persistence.commitImmediateInputs(nextInputs);
    }
    close();
  }

  function renderCreateStep() {
    if (!createDraft || !dom.financialModalRows) return;
    if (createStep === "confirm") renderCreateConfirm();
    else renderCreateDetails();
  }

  function bind() {
    if (dom.summaryCards) {
      dom.summaryCards.addEventListener("click", (event) => {
        const button = event.target.closest?.("[data-financial-category]");
        if (!button) return;
        open(button.dataset.financialCategory);
      });
    }
    if (dom.financialModalRows) {
      dom.financialModalRows.addEventListener("input", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
        const householdField = target.dataset.householdField;
        if (householdField) {
          return;
        }
        const row = target.closest("[data-modal-row-index]");
        const field = target.dataset.financialModalField;
        if (row && field) updateDraftFromField(row, field, target.value);
      });
      dom.financialModalRows.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
        const householdField = target.dataset.householdField;
        if (householdField) {
          return;
        }
        const row = target.closest("[data-modal-row-index]");
        const field = target.dataset.financialModalField;
        if (row && field) updateDraftFromField(row, field, target.value);
      });
      dom.financialModalRows.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const tabButton = target.closest?.("[data-outflow-tab]");
        if (tabButton) {
          pruneEmptyTemporaryRows();
          activeOutflowTab = tabButton.dataset.outflowTab || "living";
          editingIndex = { category: "", index: -1 };
          createDraft = null;
          createStep = "detail";
          if (dom.financialModalSave) dom.financialModalSave.hidden = false;
          if (dom.financialModalCreate) dom.financialModalCreate.hidden = false;
          renderRows();
          return;
        }
        const moneyStep = target.closest?.("[data-money-step]");
        if (moneyStep) {
          event.preventDefault();
          const row = moneyStep.closest("[data-modal-row-index]");
          const direction = moneyStep.dataset.moneyStep === "down" ? -1 : 1;
          adjustMoneyField(row, moneyStep.dataset.moneyField || "amount", direction * 10000);
          return;
        }
        const moneyQuick = target.closest?.("[data-money-quick]");
        if (moneyQuick) {
          event.preventDefault();
          const row = moneyQuick.closest("[data-modal-row-index]");
          adjustMoneyField(row, moneyQuick.dataset.moneyField || "amount", Number(moneyQuick.dataset.moneyQuick) || 0);
          return;
        }
        const varianceQuick = target.closest?.("[data-variance-quick]");
        if (varianceQuick) {
          event.preventDefault();
          const row = varianceQuick.closest("[data-modal-row-index]");
          adjustMoneyField(row, varianceQuick.dataset.moneyField || "varianceAmount", Number(varianceQuick.dataset.varianceQuick) || 0);
          return;
        }
        if (handleAdjustmentClick(target)) return;
        if (target.closest?.("[data-financial-inline-add]")) {
          startInlineCreateRow();
          return;
        }
        if (target.closest?.("[data-financial-add-group]")) {
          addGroupToActiveTab();
          return;
        }
        if (target.closest?.("#financialCreateNewAccountToggle")) {
          readCreateFields();
          createDraft.useNewAccount = !createDraft.useNewAccount;
          renderCreateDetails();
          return;
        }
        if (target.closest?.("#financialCreateReview")) {
          renderCreateConfirm();
          return;
        }
        if (target.closest?.("#financialCreateBack")) {
          createStep = "detail";
          renderCreateDetails();
          return;
        }
        if (target.closest?.("#financialCreateSave")) {
          commitCreateDraft();
          return;
        }
        if (target.closest?.("#financialCreateCancel")) {
          createDraft = null;
          createStep = "detail";
          if (dom.financialModalSave) dom.financialModalSave.hidden = false;
          if (dom.financialModalCreate) dom.financialModalCreate.hidden = false;
          renderRows();
          return;
        }

        const removeButton = target.closest?.("[data-financial-modal-remove]");
        if (removeButton) {
          event.stopPropagation();
          removeItem(
            removeButton.dataset.financialModalCategory || activeCategory,
            Number(removeButton.dataset.financialModalRemove),
          );
          return;
        }

        // 배지 클릭 시 인라인 셀렉트 변환
        const badge = target.closest("[data-badge-account-index]");
        if (badge) {
          event.stopPropagation();
          const idx = Number(badge.dataset.badgeAccountIndex);
          const accounts = safeItems(getInputs().accounts);
          convertToSelect(badge, idx, accounts);
          return;
        }

        // 에디트 버튼 클릭 시
        const editButton = target.closest?.("[data-financial-modal-edit]");
        if (editButton) {
          editingIndex = {
            category: editButton.dataset.financialModalCategory || activeCategory,
            index: Number(editButton.dataset.financialModalEdit),
          };
          renderRows();
          return;
        }

        // 카드 자체 클릭 시 편집 진입
        const row = target.closest(".financial-modal-row, .financial-variable-row");
        if (row && !target.closest("button") && !target.closest("select") && !target.closest("input")) {
          const idx = Number(row.dataset.modalRowIndex);
          const category = row.dataset.modalRowCategory || activeCategory;
          if (editingIndex.category !== category || editingIndex.index !== idx) {
            editingIndex = { category, index: idx };
            renderRows();
          }
          syncFinancialModalPendingBar();
        }
      });
      dom.financialModalRows.addEventListener("dragstart", (event) => {
        const row = event.target.closest?.("[data-draggable-outflow-item]");
        if (!row || !event.dataTransfer) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/json", JSON.stringify({
          category: row.dataset.modalRowCategory || activeCategory,
          index: Number(row.dataset.modalRowIndex),
        }));
      });
      dom.financialModalRows.addEventListener("dragover", (event) => {
        const section = event.target.closest?.("[data-group-drop-name]");
        if (!section) return;
        event.preventDefault();
        section.classList.add("is-drag-over");
      });
      dom.financialModalRows.addEventListener("dragleave", (event) => {
        const section = event.target.closest?.("[data-group-drop-name]");
        if (!section) return;
        section.classList.remove("is-drag-over");
      });
      dom.financialModalRows.addEventListener("drop", (event) => {
        const section = event.target.closest?.("[data-group-drop-name]");
        if (!section || !event.dataTransfer) return;
        event.preventDefault();
        section.classList.remove("is-drag-over");
        let payload = null;
        try {
          payload = JSON.parse(event.dataTransfer.getData("application/json") || "null");
        } catch {
          payload = null;
        }
        if (!payload) return;
        const targetCategory = section.dataset.groupDropCategory || payload.category || activeCategory;
        if (section.dataset.groupDropScope !== "future" && payload.category !== targetCategory) return;
        moveItemToGroup(targetCategory, Number(payload.index), section.dataset.groupDropName || "");
      });
    }
    if (dom.financialModalSummary) {
      dom.financialModalSummary.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        handleAdjustmentClick(target);
      });
    }
    if (dom.financialModal) {
      dom.financialModal.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target === dom.financialModal) {
          event.stopPropagation();
          close();
          return;
        }
        if (!hasEditingSelection()) return;
        if (target.closest(".financial-modal-row, .financial-variable-row, .financial-modal-pending-bar")) return;
        if (target.closest("button, input, select, textarea")) return;
        foldEditingRow();
        renderRows();
      });
    }
    if (dom.financialModal) {
      dom.financialModal.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target === dom.financialModal) return;
        if (!hasEditingSelection()) return;
        if (target.closest(".financial-modal-row, .financial-variable-row, #financialModalPendingBar, [data-financial-detail-tabs], button, input, select, textarea")) return;
        foldEditingRow();
        renderRows();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !dom.financialModal || dom.financialModal.hidden) return;
      close();
    });
    document.addEventListener("open-financial-modal", (event) => {
      const category = event.detail?.category;
      if (category) open(category);
    });
    if (dom.financialModalClose) dom.financialModalClose.addEventListener("click", close);
    if (dom.financialModalCancel) dom.financialModalCancel.addEventListener("click", cancelPendingChanges);
    if (dom.financialModalSave) dom.financialModalSave.addEventListener("click", save);
    if (dom.financialModalCreate) dom.financialModalCreate.addEventListener("click", startCreateFlow);
    if (dom.financialSettingsDetail) dom.financialSettingsDetail.addEventListener("click", () => open("income"));
  }

  return {
    bind,
    open,
    close,
    save,
  };
}
