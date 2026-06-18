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

  function getInputs() {
    return typeof getVisibleInputs === "function" ? getVisibleInputs() : {};
  }

  function syncStats() {
    if (!dom.financialModalSummary) return;
    const total = activeCategory === "account"
      ? draftItems.length
      : draftItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalLabel = activeCategory === "account"
      ? `${draftItems.length}개 계좌`
      : IsfUtils.formatMoney(total);
    dom.financialModalSummary.textContent = `${CATEGORY_CONFIG[activeCategory]?.label || ""} ${draftItems.length}개 · ${totalLabel}`;
  }

  function updateDraftFromField(row, field, value) {
    const index = Number(row.dataset.modalRowIndex);
    const item = draftItems[index];
    if (!item) return;

    if (field === "name") item.name = String(value || "").slice(0, 32);
    if (field === "amount") item.amount = IsfUtils.toWon(value || "0");
    if (field === "group") item.group = normalizeAllocationGroupName(value || "");
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
    syncStats();
  }

  function renderRow(item, index, accounts) {
    const row = document.createElement("article");
    row.className = "financial-modal-row";
    row.dataset.modalRowCategory = activeCategory;
    row.dataset.modalRowIndex = String(index);

    const header = document.createElement("div");
    header.className = "financial-modal-row__header";
    header.appendChild(createText("strong", "", item.name || `${CATEGORY_CONFIG[activeCategory].label} ${index + 1}`));
    if (activeCategory !== "account") {
      header.appendChild(createText("span", "financial-modal-account-badge", getAccountName(accounts, item.accountId)));
    }
    row.appendChild(header);

    const fields = document.createElement("div");
    fields.className = "financial-modal-row__fields";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = item.name || "";
    nameInput.dataset.financialModalField = "name";
    appendField(fields, activeCategory === "account" ? "계좌 별칭" : "이름", nameInput);

    if (activeCategory !== "account") {
      const amountInput = document.createElement("input");
      amountInput.type = "text";
      amountInput.inputMode = "decimal";
      amountInput.value = formatAmount(item.amount);
      amountInput.dataset.moneyInput = "won";
      amountInput.dataset.financialModalField = "amount";
      appendField(fields, "금액(원)", amountInput);

      const selectedAccountId = item.accountId || recommendAccountId(getInputs(), activeCategory, item);
      item.accountId = selectedAccountId;
      appendField(fields, CATEGORY_CONFIG[activeCategory].accountLabel, createAccountSelect(accounts, selectedAccountId, "accountId"));
    }

    if (["expense", "savings", "invest"].includes(activeCategory)) {
      const groupInput = document.createElement("input");
      groupInput.type = "text";
      groupInput.value = item.group || "";
      groupInput.dataset.financialModalField = "group";
      appendField(fields, "그룹", groupInput);
    }

    if (activeCategory === "savings") {
      const rateInput = document.createElement("input");
      rateInput.type = "number";
      rateInput.step = "0.1";
      rateInput.value = item.annualRate ?? "";
      rateInput.dataset.financialModalField = "annualRate";
      appendField(fields, "연이율(%)", rateInput);
    }

    if (activeCategory === "savings" || activeCategory === "invest") {
      const maturityInput = document.createElement("input");
      maturityInput.type = "month";
      maturityInput.value = item.maturityMonth || "";
      maturityInput.dataset.financialModalField = "maturityMonth";
      appendField(fields, "만기/해지월", maturityInput);
    }

    row.appendChild(fields);
    return row;
  }

  function renderRows() {
    if (!dom.financialModalRows) return;
    const accounts = safeItems(getInputs().accounts);
    dom.financialModalRows.replaceChildren(...draftItems.map((item, index) => renderRow(item, index, accounts)));
    syncStats();
    IsfUtils.updateAllKoreanWonHints(dom.financialModalRows);
  }

  function open(category) {
    const config = CATEGORY_CONFIG[category];
    if (!config || !dom.financialModal) return;
    activeCategory = category;
    baselineInputs = clone(getInputs());
    draftItems = getItemsForCategory(baselineInputs, category);

    if (dom.financialModalTitle) dom.financialModalTitle.textContent = `${config.label} 상세 편집`;
    if (dom.financialModalDescription) {
      dom.financialModalDescription.textContent = category === "account"
        ? "계좌 별칭만 가볍게 정리합니다. 별도 계좌 관리 화면은 만들지 않습니다."
        : "항목 이름, 금액, 연결 계좌를 확인하고 저장할 때만 요약 화면에 반영합니다.";
    }
    renderRows();
    dom.financialModal.hidden = false;
    window.setTimeout(() => dom.financialModal.classList.add("is-active"), 10);
  }

  function close() {
    if (!dom.financialModal) return;
    dom.financialModal.classList.remove("is-active");
    activeCategory = "";
    baselineInputs = null;
    draftItems = [];
    window.setTimeout(() => {
      dom.financialModal.hidden = true;
    }, 250);
  }

  function save() {
    if (!activeCategory || !baselineInputs) return;
    const validationMessage = validateItems(activeCategory, draftItems);
    if (validationMessage) {
      window.alert(validationMessage);
      return;
    }
    const nextInputs = setItemsForCategory(baselineInputs, activeCategory, draftItems);
    if (persistence && typeof persistence.commitImmediateInputs === "function") {
      persistence.commitImmediateInputs(nextInputs);
    } else if (typeof renderAll === "function") {
      renderAll();
    }
    close();
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
        const row = target.closest("[data-modal-row-index]");
        const field = target.dataset.financialModalField;
        if (row && field) updateDraftFromField(row, field, target.value);
      });
      dom.financialModalRows.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
        const row = target.closest("[data-modal-row-index]");
        const field = target.dataset.financialModalField;
        if (row && field) updateDraftFromField(row, field, target.value);
      });
    }
    if (dom.financialModalClose) dom.financialModalClose.addEventListener("click", close);
    if (dom.financialModalCancel) dom.financialModalCancel.addEventListener("click", close);
    if (dom.financialModalSave) dom.financialModalSave.addEventListener("click", save);
  }

  return {
    bind,
    open,
    close,
    save,
  };
}

