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
  let editingIndex = -1;
  let customGroupIndexes = new Set();

  function getInputs() {
    return typeof getVisibleInputs === "function" ? getVisibleInputs() : {};
  }

  function syncFinancialModalPendingBar() {
    if (!dom.financialModalPendingBar) return;

    const hasChanges = () => {
      if (!activeCategory || !baselineInputs) return false;
      const baseItems = getItemsForCategory(baselineInputs, activeCategory);
      return JSON.stringify(baseItems) !== JSON.stringify(draftItems);
    };

    const isVisible = (editingIndex !== -1 && !createDraft) || hasChanges();

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
    const select = document.createElement("select");
    select.className = "financial-modal-account-inline-select";
    accounts.forEach((acc) => {
      const opt = document.createElement("option");
      opt.value = acc.id;
      opt.textContent = acc.name;
      if (acc.id === draftItems[idx].accountId) opt.selected = true;
      select.appendChild(opt);
    });
    
    select.onchange = () => {
      draftItems[idx].accountId = select.value;
      if (activeCategory === "income") {
        draftItems[idx].allocations = [{ accountId: select.value, amount: Number(draftItems[idx].amount) || 0 }];
      }
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
    syncStats();
  }

  function renderCompactRow(item, index, accounts) {
    const row = document.createElement("article");
    row.className = "financial-modal-row";
    row.dataset.modalRowCategory = activeCategory;
    row.dataset.modalRowIndex = String(index);

    const header = document.createElement("div");
    header.className = "financial-modal-row__header";
    header.appendChild(createText("strong", "", getItemLabel(item, activeCategory, index)));
    if (activeCategory !== "account") {
      const badge = createText("span", "financial-modal-account-badge clickable", getAccountName(accounts, item.accountId));
      badge.dataset.badgeAccountIndex = String(index);
      header.appendChild(badge);
    }
    row.appendChild(header);

    const summary = document.createElement("div");
    summary.className = "financial-modal-row__summary";
    if (activeCategory === "account") {
      summary.appendChild(createText("span", "", "계좌 별칭"));
    } else {
      summary.append(
        createText("span", "", IsfUtils.formatMoney(Number(item.amount) || 0)),
        createText("span", "", item.group || CATEGORY_CONFIG[activeCategory].label),
      );
    }
    row.appendChild(summary);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn-ghost btn-sm financial-modal-row__edit";
    edit.dataset.financialModalEdit = String(index);
    edit.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    row.appendChild(edit);

    return row;
  }

  function renderEditingRow(item, index, accounts) {
    const row = renderCompactRow(item, index, accounts);
    row.classList.add("financial-modal-row--editing");

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
      const groupSelect = createGroupSelect(draftItems, activeCategory, item.group, customGroupIndexes.has(index));
      appendField(fields, "그룹", groupSelect);
      if (groupSelect.value === "__custom__") {
        const groupInput = document.createElement("input");
        groupInput.type = "text";
        groupInput.value = item.group || "";
        groupInput.dataset.financialModalField = "group";
        appendField(fields, "직접 입력", groupInput);
      }
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

  function renderRow(item, index, accounts) {
    return index === editingIndex
      ? renderEditingRow(item, index, accounts)
      : renderCompactRow(item, index, accounts);
  }

  function renderRows() {
    if (!dom.financialModalRows) return;
    if (createDraft) {
      renderCreateStep();
      return;
    }
    const accounts = safeItems(getInputs().accounts);
    dom.financialModalRows.replaceChildren(...draftItems.map((item, index) => renderRow(item, index, accounts)));
    syncStats();
    IsfUtils.updateAllKoreanWonHints(dom.financialModalRows);
    syncFinancialModalPendingBar();
  }

  function open(category) {
    const config = CATEGORY_CONFIG[category];
    if (!config || !dom.financialModal) return;
    activeCategory = category;
    baselineInputs = clone(getInputs());
    draftItems = getItemsForCategory(baselineInputs, category);
    createDraft = null;
    createStep = "detail";
    editingIndex = -1;
    customGroupIndexes = new Set();

    if (dom.financialModalTitle) dom.financialModalTitle.textContent = `${config.label} 상세 편집`;
    if (dom.financialModalDescription) {
      dom.financialModalDescription.textContent = category === "account"
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
    createDraft = null;
    createStep = "detail";
    editingIndex = -1;
    customGroupIndexes = new Set();
    window.setTimeout(() => {
      dom.financialModal.hidden = true;
    }, 250);
    syncFinancialModalPendingBar();
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
    syncFinancialModalPendingBar();
  }

  function getRecommendedAccountId() {
    const inputs = getInputs();
    return recommendAccountId(inputs, activeCategory, {});
  }

  function startCreateFlow() {
    const recommendedAccountId = activeCategory === "account" ? "" : getRecommendedAccountId();
    createDraft = {
      name: "",
      amount: 0,
      group: activeCategory === "expense" ? "고정비" : CATEGORY_CONFIG[activeCategory]?.label || "",
      accountId: recommendedAccountId,
      accountName: "",
      useNewAccount: false,
    };
    createStep = "detail";
    editingIndex = -1;
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

    const title = createText("h3", "financial-create-step__title", `${CATEGORY_CONFIG[activeCategory].label} 추가`);
    const grid = document.createElement("div");
    grid.className = "financial-create-grid";

    grid.appendChild(makeCreateField(
      activeCategory === "account" ? "계좌 별칭" : "이름",
      createInput("name", createDraft.name),
    ));

    if (activeCategory !== "account") {
      grid.appendChild(makeCreateField(
        "금액(원)",
        createInput("amount", createDraft.amount ? formatAmount(createDraft.amount) : "", { inputMode: "decimal" }),
      ));

      const groupInput = createInput("group", createDraft.group || CATEGORY_CONFIG[activeCategory].label);
      grid.appendChild(makeCreateField("그룹", groupInput));

      const accountSelect = createAccountSelect(getInputs().accounts, createDraft.accountId, "accountId");
      accountSelect.id = "financialCreateAccountSelect";
      grid.appendChild(makeCreateField(CATEGORY_CONFIG[activeCategory].accountLabel, accountSelect));

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
    if (!String(createDraft?.name || "").trim()) return "이름을 입력해 주세요.";
    if (activeCategory !== "account") {
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

    const confirm = document.createElement("section");
    confirm.className = "financial-create-confirm";
    confirm.id = "financialCreateConfirm";
    confirm.dataset.createStep = "confirm";

    const title = createText("h3", "financial-create-step__title", "최종 확인");
    const rows = document.createElement("div");
    rows.className = "financial-create-confirm__rows";

    const summaryRows = [
      ["항목", createDraft.name],
      ["금액", activeCategory === "account" ? "계좌 별칭" : IsfUtils.convertToKoreanWon(createDraft.amount)],
      ["연결 계좌", activeCategory === "account" ? createDraft.name : getCreateAccountName()],
      ["그룹/유형", activeCategory === "account" ? "계좌" : `${CATEGORY_CONFIG[activeCategory].label} · ${createDraft.group || CATEGORY_CONFIG[activeCategory].label}`],
      ["보정", createDraft.useNewAccount ? "새 계좌 생성 후 연결" : "자동 보정 없음"],
    ];
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
    if (!createDraft.useNewAccount || activeCategory === "account") return null;
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
    let nextInputs = {
      ...base,
      accounts: safeItems(base.accounts).map((account) => ({ ...account })),
    };

    if (activeCategory === "account") {
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
        id: `${activeCategory}-${Date.now()}`,
        name: String(createDraft.name || "").trim(),
        amount: Number(createDraft.amount) || 0,
        group: normalizeAllocationGroupName(createDraft.group || CATEGORY_CONFIG[activeCategory].label),
        accountId,
      };
      if (activeCategory === "income") {
        delete newItem.group;
        newItem.tone = "income";
        newItem.allocations = [{ accountId, amount: newItem.amount }];
      } else {
        newItem.tone = activeCategory;
      }

      nextInputs = setItemsForCategory(nextInputs, activeCategory, [
        ...getItemsForCategory(nextInputs, activeCategory),
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
      dom.financialModalRows.addEventListener("click", (event) => {
        const target = event.target;
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
          editingIndex = Number(editButton.dataset.financialModalEdit);
          renderRows();
          return;
        }

        // 카드 자체 클릭 시 편집 진입
        const row = target.closest(".financial-modal-row");
        if (row && !target.closest("button") && !target.closest("select") && !target.closest("input")) {
          const idx = Number(row.dataset.modalRowIndex);
          if (editingIndex !== idx) {
            editingIndex = idx;
            renderRows();
          }
        }
      });
    }
    if (dom.financialModalClose) dom.financialModalClose.addEventListener("click", close);
    if (dom.financialModalCancel) dom.financialModalCancel.addEventListener("click", close);
    if (dom.financialModalSave) dom.financialModalSave.addEventListener("click", save);
    if (dom.financialModalCreate) dom.financialModalCreate.addEventListener("click", startCreateFlow);
  }

  return {
    bind,
    open,
    close,
    save,
  };
}
