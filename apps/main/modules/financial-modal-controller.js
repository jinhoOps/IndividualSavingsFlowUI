import { IsfUtils } from "../../../shared/core/utils.js";

import {
  normalizeAllocationGroupName,
  parseSavingsAnnualRateInput,
} from "./input-sanitizer.js";
import { recommendAccountId } from "./account-correction.js";
import { dom } from "./dom.js";

const CATEGORY_CONFIG = {
  income: { label: "수입", itemKey: "incomes", accountLabel: "입금 계좌" },
  account: { label: "계좌", itemKey: "accounts", accountLabel: "" },
  expense: { label: "지출", itemKey: "expenseItems", accountLabel: "출금 계좌" },
  savings: { label: "저축", itemKey: "savingsItems", accountLabel: "이체 계좌" },
  invest: { label: "투자", itemKey: "investItems", accountLabel: "투자 계좌" },
};

const OUTFLOW_CATEGORIES = ["expense", "savings", "invest"];
const OUTFLOW_TAB_CATEGORIES = {
  living: ["expense"],
  future: ["savings", "invest"],
};

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

export function createFinancialModalController({ persistence, getVisibleInputs, renderAll } = {}) {
  let activeCategory = "";
  let baselineInputs = null;
  let draftItems = [];
  let createDraft = null;
  let createStep = "detail";
  let editingIndex = { category: "", index: -1 };
  let activeOutflowTab = "living";
  let outflowDrafts = null;
  let customGroupNames = {};
  let customGroupIndexes = new Set();
  let householdContextChanged = false;

  function getInputs() {
    return typeof getVisibleInputs === "function" ? getVisibleInputs() : {};
  }

  function isOutflowCategory(category) {
    return OUTFLOW_CATEGORIES.includes(category);
  }

  function isOutflowMode() {
    return isOutflowCategory(activeCategory) && outflowDrafts;
  }

  function getRenderedCategories() {
    if (!isOutflowMode()) return [activeCategory];
    return OUTFLOW_TAB_CATEGORIES[activeOutflowTab] || ["expense"];
  }

  function getDraftItemsForCategory(category) {
    return isOutflowMode() ? safeItems(outflowDrafts?.[category]) : draftItems;
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
    return OUTFLOW_CATEGORIES.flatMap((category) => getDraftItemsForCategory(category));
  }

  function getCreateCategory() {
    if (!isOutflowMode()) return activeCategory;
    if (activeOutflowTab === "living") return "expense";
    return activeCategory === "invest" ? "invest" : "savings";
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
    if (!isOutflowMode() || activeOutflowTab === "living") {
      return getGroupNames("expense");
    }
    const groups = new Set(["저축-투자"]);
    OUTFLOW_TAB_CATEGORIES.future.forEach((category) => {
      getDraftItemsForCategory(category).forEach((item) => {
        const group = normalizeAllocationGroupName(item.group || "");
        if (group && group !== "저축" && group !== "투자") groups.add(group);
      });
      safeItems(customGroupNames[category]).forEach((group) => {
        if (group && group !== "저축" && group !== "투자") groups.add(group);
      });
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

    const hasChanges = () => {
      if (!activeCategory || !baselineInputs) return false;
      if (isOutflowMode()) {
        if (householdContextChanged) return true;
        return OUTFLOW_CATEGORIES.some((category) => {
          const baseItems = getItemsForCategory(baselineInputs, category);
          return JSON.stringify(baseItems) !== JSON.stringify(getDraftItemsForCategory(category));
        });
      }
      const baseItems = getItemsForCategory(baselineInputs, activeCategory);
      return JSON.stringify(baseItems) !== JSON.stringify(draftItems);
    };

    const isVisible = (hasEditingSelection() && !createDraft) || hasChanges();

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
      if (activeCategory === "income") {
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
    const statItems = isOutflowMode() ? getRenderedCategories().flatMap((category) => getDraftItemsForCategory(category)) : draftItems;
    const total = activeCategory === "account"
      ? statItems.length
      : statItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalLabel = activeCategory === "account"
      ? `${statItems.length}개 계좌`
      : IsfUtils.formatMoney(total);
    const label = isOutflowMode()
      ? activeOutflowTab === "living" ? "생활비" : "저축-투자"
      : CATEGORY_CONFIG[activeCategory]?.label || "";
    dom.financialModalSummary.textContent = `${label} ${statItems.length}개 · ${totalLabel}`;
  }

  function getDraftInputsForActiveCategory() {
    if (isOutflowMode()) {
      return OUTFLOW_CATEGORIES.reduce((inputs, category) => setItemsForCategory(inputs, category, getDraftItemsForCategory(category)), baselineInputs || getInputs());
    }
    return setItemsForCategory(baselineInputs || getInputs(), activeCategory, draftItems);
  }

  function removeHouseholdOverview() {
    dom.financialModal?.querySelector("[data-household-overview]")?.remove();
  }

  function updateDraftFromField(row, field, value) {
    const category = row.dataset.modalRowCategory || activeCategory;
    const index = Number(row.dataset.modalRowIndex);
    const items = getDraftItemsForCategory(category);
    const item = items[index];
    if (!item) return;

    if (field === "name") item.name = String(value || "").slice(0, 32);
    if (field === "amount") item.amount = IsfUtils.toWon(value || "0");
    if (field === "group") item.group = normalizeAllocationGroupName(value || "");
    if (field === "groupMode") {
      if (value === "__custom__") {
        customGroupIndexes.add(index);
        if (buildGroupOptions(draftItems, activeCategory).includes(item.group)) item.group = "";
        renderRows();
      } else {
        customGroupIndexes.delete(index);
        item.group = normalizeAllocationGroupName(value || "");
        renderRows();
      }
      return;
    }
    if (field === "accountId") {
      item.accountId = value;
      if (activeCategory === "income") {
        item.allocations = [{ accountId: value, amount: Number(item.amount) || 0 }];
      }
    }
    if (field === "annualRate") {
      const parsed = parseSavingsAnnualRateInput(value || "", getInputs().annualSavingsYield);
      if (parsed === null) delete item.annualRate;
      else item.annualRate = parsed;
    }
    if (field === "maturityMonth") {
      if (value) item.maturityMonth = value;
      else delete item.maturityMonth;
    }
    setDraftItemsForCategory(category, items);
    syncStats();
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
    if (rowCategory !== "account") {
      const badge = createText("span", "financial-modal-account-badge clickable", getAccountName(accounts, item.accountId));
      badge.dataset.badgeAccountIndex = String(index);
      badge.dataset.badgeAccountCategory = rowCategory;
      header.appendChild(badge);
    }
    row.appendChild(header);

    const summary = document.createElement("div");
    summary.className = "financial-modal-row__summary";
    if (rowCategory === "account") {
      summary.appendChild(createText("span", "", "계좌 별칭"));
    } else {
      summary.append(
        createText("span", "", IsfUtils.formatMoney(Number(item.amount) || 0)),
        createText("span", "", item.group || CATEGORY_CONFIG[rowCategory].label),
      );
      if (isOutflowMode() && rowCategory !== "expense") {
        summary.appendChild(createText("span", "", CATEGORY_CONFIG[rowCategory].label));
      }
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
      appendField(fields, "출처 계좌", createAccountSelect(accounts, selectedAccountId, "accountId"));

      const amountInput = document.createElement("input");
      amountInput.type = "text";
      amountInput.inputMode = "decimal";
      amountInput.value = formatAmount(item.amount);
      amountInput.dataset.moneyInput = "won";
      amountInput.dataset.financialModalField = "amount";
      appendField(fields, "금액", amountInput);
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

  function renderOutflowTabs() {
    const tabs = document.createElement("div");
    tabs.className = "financial-modal-tabs";
    tabs.setAttribute("role", "tablist");
    [
      ["living", "생활비"],
      ["future", "저축-투자"],
    ].forEach(([key, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `financial-modal-tab ${activeOutflowTab === key ? "is-active" : ""}`;
      button.dataset.outflowTab = key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(activeOutflowTab === key));
      button.textContent = label;
      tabs.appendChild(button);
    });
    return tabs;
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
    const grouped = OUTFLOW_TAB_CATEGORIES.future.flatMap((category) => (
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

    const toolbar = document.createElement("div");
    toolbar.className = "financial-group-toolbar";
    const addGroup = document.createElement("button");
    addGroup.type = "button";
    addGroup.className = "btn btn-ghost btn-sm";
    addGroup.dataset.financialAddGroup = "true";
    addGroup.textContent = "그룹 추가";
    toolbar.appendChild(addGroup);
    fragment.appendChild(toolbar);

    const groups = document.createElement("div");
    groups.className = "financial-group-board";
    if (activeOutflowTab === "future") {
      getRenderedGroupNames().forEach((groupName) => {
        groups.appendChild(renderCombinedFutureGroupSection(groupName, accounts));
      });
    } else {
      getRenderedCategories().forEach((category) => {
        getGroupNames(category).forEach((groupName) => {
          groups.appendChild(renderGroupSection(category, groupName, accounts));
        });
      });
    }
    fragment.appendChild(groups);
    dom.financialModalRows.replaceChildren(fragment);
  }

  function addGroupToActiveTab() {
    const category = getCreateCategory();
    const rawName = window.prompt("새 그룹명을 입력해 주세요.");
    const name = normalizeAllocationGroupName(rawName || "");
    if (!name) return;
    if (activeOutflowTab === "future") {
      customGroupNames = {
        ...customGroupNames,
        savings: Array.from(new Set([...safeItems(customGroupNames.savings), name])),
        invest: Array.from(new Set([...safeItems(customGroupNames.invest), name])),
      };
    } else {
      customGroupNames = {
        ...customGroupNames,
        [category]: Array.from(new Set([...safeItems(customGroupNames[category]), name])),
      };
    }
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
    const label = getItemLabel(item, category, index);
    if (!window.confirm(`${label} 항목을 삭제할까요?`)) return;
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

  function open(category = "expense") {
    const config = CATEGORY_CONFIG[category];
    if (!config || !dom.financialModal) return;
    activeCategory = category;
    baselineInputs = clone(getInputs());
    if (isOutflowCategory(category)) {
      outflowDrafts = OUTFLOW_CATEGORIES.reduce((drafts, key) => ({
        ...drafts,
        [key]: getItemsForCategory(baselineInputs, key),
      }), {});
      draftItems = getDraftItemsForCategory(category);
      activeOutflowTab = category === "expense" ? "living" : "future";
      customGroupNames = OUTFLOW_CATEGORIES.reduce((groups, key) => ({
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

    if (dom.financialModalTitle) {
      dom.financialModalTitle.textContent = "재무설정 상세";
    }
    if (dom.financialModalDescription) {
      dom.financialModalDescription.textContent = isOutflowCategory(category)
        ? "생활비와 저축-투자를 한 흐름에서 확인합니다. 변경 내용은 저장할 때만 요약 화면에 반영됩니다."
        : category === "account"
        ? "계좌 별칭만 가볍게 정리합니다. 별도 계좌 관리 화면은 만들지 않습니다."
        : "항목 이름, 금액, 연결 계좌를 확인하고 저장할 때만 요약 화면에 반영합니다.";
    }
    renderRows();
    if (dom.financialModalSave) dom.financialModalSave.hidden = false;
    if (dom.financialModalCreate) {
      dom.financialModalCreate.hidden = false;
      dom.financialModalCreate.textContent = category === "account" ? "새 계좌 추가" : "새 항목 추가";
    }
    dom.financialModal.hidden = false;
    window.setTimeout(() => dom.financialModal.classList.add("is-active"), 10);
    syncFinancialModalPendingBar();
  }

  function close() {
    if (!dom.financialModal) return;
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
    removeHouseholdOverview();
    window.setTimeout(() => {
      dom.financialModal.hidden = true;
    }, 250);
    syncFinancialModalPendingBar();
  }

  function save() {
    if (!activeCategory || !baselineInputs) return;
    const validationMessage = isOutflowMode()
      ? OUTFLOW_CATEGORIES.map((category) => validateItems(category, getDraftItemsForCategory(category))).find(Boolean)
      : validateItems(activeCategory, draftItems);
    if (validationMessage) {
      window.alert(validationMessage);
      return;
    }
    const nextInputs = isOutflowMode()
      ? OUTFLOW_CATEGORIES.reduce((inputs, category) => setItemsForCategory(inputs, category, getDraftItemsForCategory(category)), baselineInputs)
      : setItemsForCategory(baselineInputs, activeCategory, draftItems);
    if (persistence && typeof persistence.commitImmediateInputs === "function") {
      persistence.commitImmediateInputs(nextInputs);
    } else if (typeof renderAll === "function") {
      renderAll();
    }
    close();
    householdContextChanged = false;
    syncFinancialModalPendingBar();
  }

  function getRecommendedAccountId() {
    const inputs = getInputs();
    return recommendAccountId(inputs, getCreateCategory(), {});
  }

  function startCreateFlow() {
    const createCategory = getCreateCategory();
    const recommendedAccountId = createCategory === "account" ? "" : getRecommendedAccountId();
    createDraft = {
      name: "",
      amount: 0,
      category: createCategory,
      group: getGroupNames(createCategory)[0] || CATEGORY_CONFIG[createCategory]?.label || "",
      accountId: recommendedAccountId,
      accountName: "",
      useNewAccount: false,
    };
    createStep = "detail";
    editingIndex = { category: "", index: -1 };
    customGroupIndexes = new Set();
    if (dom.financialModalSave) dom.financialModalSave.hidden = true;
    if (dom.financialModalCreate) dom.financialModalCreate.hidden = true;
    renderCreateStep();
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
          activeOutflowTab = tabButton.dataset.outflowTab || "living";
          editingIndex = { category: "", index: -1 };
          createDraft = null;
          createStep = "detail";
          if (dom.financialModalSave) dom.financialModalSave.hidden = false;
          if (dom.financialModalCreate) dom.financialModalCreate.hidden = false;
          renderRows();
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
        const row = target.closest(".financial-modal-row");
        if (row && !target.closest("button") && !target.closest("select") && !target.closest("input")) {
          const idx = Number(row.dataset.modalRowIndex);
          const category = row.dataset.modalRowCategory || activeCategory;
          if (editingIndex.category !== category || editingIndex.index !== idx) {
            editingIndex = { category, index: idx };
            renderRows();
          }
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
    document.addEventListener("open-financial-modal", (event) => {
      const category = event.detail?.category;
      if (category) open(category);
    });
    if (dom.financialModalClose) dom.financialModalClose.addEventListener("click", close);
    if (dom.financialModalCancel) dom.financialModalCancel.addEventListener("click", close);
    if (dom.financialModalSave) dom.financialModalSave.addEventListener("click", save);
    if (dom.financialModalCreate) dom.financialModalCreate.addEventListener("click", startCreateFlow);
    if (dom.financialSettingsDetail) dom.financialSettingsDetail.addEventListener("click", () => open("expense"));
  }

  return {
    bind,
    open,
    close,
    save,
  };
}
