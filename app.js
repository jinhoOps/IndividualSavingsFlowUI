const MONEY_UNIT = 10000;
const STORAGE_KEY = "isf-rebuild-v1";
const MAX_INCOME_ITEMS = 12;
const MAX_ALLOCATION_ITEMS = 20;

const DEFAULT_EXPENSE_ITEMS = [
  { id: "rent", name: "주거비(월세)", amount: 60 },
  { id: "maintenance", name: "관리비", amount: 10 },
  { id: "telecom", name: "통신비", amount: 5 },
  { id: "transport", name: "교통비", amount: 10 },
  { id: "food", name: "식비", amount: 40 },
  { id: "etc", name: "기타생활비", amount: 20 },
];

const DEFAULT_SAVINGS_ITEMS = [
  { id: "youth-saving", name: "청년적금", amount: 70 },
  { id: "housing-subscription", name: "주택청약", amount: 5 },
];

const DEFAULT_INVEST_ITEMS = [
  { id: "global-stock", name: "해외주식", amount: 30 },
  { id: "isa", name: "ISA", amount: 30 },
  { id: "gold-spot", name: "금현물", amount: 3 },
];

const DEFAULT_INPUTS = {
  incomes: [
    { id: "income-main", name: "급여", amount: 300 },
  ],
  expenseItems: DEFAULT_EXPENSE_ITEMS,
  savingsItems: DEFAULT_SAVINGS_ITEMS,
  investItems: DEFAULT_INVEST_ITEMS,
  monthlyExpense: 145,
  monthlySavings: 75,
  monthlyInvest: 63,
  monthlyDebtPayment: 0,
  startCash: 100,
  startSavings: 3000,
  startInvest: 3000,
  startDebt: 0,
  annualIncomeGrowth: 4.0,
  annualExpenseGrowth: 2.5,
  annualSavingsYield: 3.0,
  annualInvestReturn: 9.5,
  annualDebtInterest: 4.2,
  horizonYears: 10,
};

const SAMPLE_INPUTS = {
  incomes: [
    { id: "income-main", name: "급여", amount: 460 },
    { id: "income-side", name: "부수입", amount: 60 },
  ],
  expenseItems: [
    { id: "rent", name: "주거비(월세)", amount: 80 },
    { id: "maintenance", name: "관리비", amount: 15 },
    { id: "telecom", name: "통신비", amount: 10 },
    { id: "transport", name: "교통비", amount: 15 },
    { id: "food", name: "식비", amount: 60 },
    { id: "etc", name: "기타생활비", amount: 30 },
  ],
  savingsItems: [
    { id: "youth-saving", name: "청년적금", amount: 70 },
    { id: "housing-subscription", name: "주택청약", amount: 40 },
  ],
  investItems: [
    { id: "global-stock", name: "해외주식", amount: 60 },
    { id: "isa", name: "ISA", amount: 40 },
    { id: "gold-spot", name: "금현물", amount: 20 },
  ],
  monthlyExpense: 210,
  monthlySavings: 110,
  monthlyInvest: 120,
  monthlyDebtPayment: 35,
  startCash: 600,
  startSavings: 450,
  startInvest: 1500,
  startDebt: 1200,
  annualIncomeGrowth: 3.5,
  annualExpenseGrowth: 2.8,
  annualSavingsYield: 2.2,
  annualInvestReturn: 7.0,
  annualDebtInterest: 4.0,
  horizonYears: 12,
};

const FORM_FIELD_KEYS = [
  "monthlyDebtPayment",
  "startCash",
  "startSavings",
  "startInvest",
  "startDebt",
  "annualIncomeGrowth",
  "annualExpenseGrowth",
  "annualSavingsYield",
  "annualInvestReturn",
  "annualDebtInterest",
  "horizonYears",
];

const TONE_COLORS = {
  income: "#1e8b7c",
  expense: "#c9573c",
  savings: "#3175b6",
  invest: "#5d4fb3",
  debt: "#8c3d65",
  surplus: "#2f9e44",
  deficit: "#d6336c",
};

const currencyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const dom = {
  inputsForm: document.getElementById("inputsForm"),
  loadSample: document.getElementById("loadSample"),
  resetInputs: document.getElementById("resetInputs"),
  addIncomeItem: document.getElementById("addIncomeItem"),
  incomeList: document.getElementById("incomeList"),
  incomeTotalHint: document.getElementById("incomeTotalHint"),
  expenseList: document.getElementById("expenseList"),
  expenseTotalHint: document.getElementById("expenseTotalHint"),
  editExpenseItems: document.getElementById("editExpenseItems"),
  expenseEditorActions: document.getElementById("expenseEditorActions"),
  addExpenseItem: document.getElementById("addExpenseItem"),
  applyExpenseItems: document.getElementById("applyExpenseItems"),
  cancelExpenseItems: document.getElementById("cancelExpenseItems"),
  savingsList: document.getElementById("savingsList"),
  savingsTotalHint: document.getElementById("savingsTotalHint"),
  editSavingsItems: document.getElementById("editSavingsItems"),
  savingsEditorActions: document.getElementById("savingsEditorActions"),
  addSavingsItem: document.getElementById("addSavingsItem"),
  applySavingsItems: document.getElementById("applySavingsItems"),
  cancelSavingsItems: document.getElementById("cancelSavingsItems"),
  investList: document.getElementById("investList"),
  investTotalHint: document.getElementById("investTotalHint"),
  editInvestItems: document.getElementById("editInvestItems"),
  investEditorActions: document.getElementById("investEditorActions"),
  addInvestItem: document.getElementById("addInvestItem"),
  applyInvestItems: document.getElementById("applyInvestItems"),
  cancelInvestItems: document.getElementById("cancelInvestItems"),
  jumpToInputs: document.getElementById("jumpToInputs"),
  pendingBar: document.getElementById("pendingBar"),
  pendingSummary: document.getElementById("pendingSummary"),
  applyChanges: document.getElementById("applyChanges"),
  cancelChanges: document.getElementById("cancelChanges"),
  applyFeedback: document.getElementById("applyFeedback"),
  summaryCards: document.getElementById("summaryCards"),
  cardMeta: document.getElementById("cardMeta"),
  sankeySvg: document.getElementById("sankeySvg"),
  sankeyWrap: document.getElementById("sankeyWrap"),
  sankeyMeta: document.getElementById("sankeyMeta"),
  sankeyLegend: document.getElementById("sankeyLegend"),
  sankeyEmpty: document.getElementById("sankeyEmpty"),
  sankeyTooltip: document.getElementById("sankeyTooltip"),
  projectionTableBody: document.querySelector("#projectionTable tbody"),
  projectionMeta: document.getElementById("projectionMeta"),
};

const state = {
  inputs: sanitizeInputs({ ...DEFAULT_INPUTS, ...loadPersistedInputs() }),
  draftInputs: null,
  applyFeedbackTimer: null,
  suspendInputTracking: false,
  itemEditors: {
    expense: { active: false, items: [] },
    savings: { active: false, items: [] },
    invest: { active: false, items: [] },
  },
  snapshot: null,
};

document.addEventListener("DOMContentLoaded", () => {
  bindControls();
  refreshInputsPanel(state.inputs);
  setPendingBarVisible(false);
  renderAll();
});

function bindControls() {
  if (dom.inputsForm) {
    const handleInput = (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !FORM_FIELD_KEYS.includes(target.name)) {
        return;
      }
      const baseInputs = ensureDraftInputs();
      state.draftInputs = sanitizeInputs(readInputsFromForm(baseInputs));
      markPendingChanges();
    };

    dom.inputsForm.addEventListener("input", handleInput);
  }

  if (dom.addIncomeItem) {
    dom.addIncomeItem.addEventListener("click", () => {
      const draftInputs = ensureDraftInputs();
      if (draftInputs.incomes.length >= MAX_INCOME_ITEMS) {
        return;
      }
      draftInputs.incomes.push(createIncomeItem({ name: `수입 ${draftInputs.incomes.length + 1}` }));
      state.draftInputs = sanitizeInputs(draftInputs);
      renderIncomeList(state.draftInputs.incomes);
      markPendingChanges();
    });
  }

  if (dom.incomeList) {
    dom.incomeList.addEventListener("input", (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      const itemId = target.dataset.incomeId;
      const field = target.dataset.field;
      if (!itemId || !field) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      const income = draftInputs.incomes.find((item) => item.id === itemId);
      if (!income) {
        return;
      }

      if (field === "name") {
        income.name = target.value.slice(0, 24);
      }

      if (field === "amount") {
        income.amount = sanitizeMoney(target.value, 0);
      }

      markPendingChanges();
    });

    dom.incomeList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const removeId = target.dataset.removeIncome;
      if (!removeId) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      if (draftInputs.incomes.length <= 1) {
        return;
      }

      draftInputs.incomes = draftInputs.incomes.filter((item) => item.id !== removeId);
      state.draftInputs = sanitizeInputs(draftInputs);
      renderIncomeList(state.draftInputs.incomes);
      markPendingChanges();
    });
  }

  if (dom.expenseList) {
    dom.expenseList.addEventListener("input", (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (state.itemEditors.expense.active) {
        const itemId = target.dataset.editorId;
        const field = target.dataset.field;
        if (!itemId || !field) {
          return;
        }
        const item = state.itemEditors.expense.items.find((entry) => entry.id === itemId);
        if (!item) {
          return;
        }
        if (field === "name") {
          const index = sanitizeInteger(target.dataset.index, 0, 0, 999);
          item.name = normalizeAllocationName(target.value, "생활비", index);
          target.value = item.name;
        }
        if (field === "amount") {
          item.amount = sanitizeMoney(target.value, 0);
        }
        renderExpenseTotalHint(
          toWon(getMonthlyAllocationTotalMan(state.itemEditors.expense.items)),
          state.itemEditors.expense.items.length,
        );
        return;
      }

      const itemId = target.dataset.expenseId;
      if (!itemId) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      const expense = draftInputs.expenseItems.find((item) => item.id === itemId);
      if (!expense) {
        return;
      }

      expense.amount = sanitizeMoney(target.value, 0);
      markPendingChanges();
    });

    dom.expenseList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !state.itemEditors.expense.active) {
        return;
      }
      const removeId = target.dataset.removeEditorItem;
      if (!removeId) {
        return;
      }
      if (state.itemEditors.expense.items.length <= 1) {
        return;
      }
      state.itemEditors.expense.items = state.itemEditors.expense.items.filter((item) => item.id !== removeId);
      renderExpenseList(state.itemEditors.expense.items, { editing: true });
      renderExpenseTotalHint(
        toWon(getMonthlyAllocationTotalMan(state.itemEditors.expense.items)),
        state.itemEditors.expense.items.length,
      );
    });
  }

  if (dom.savingsList) {
    dom.savingsList.addEventListener("input", (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (state.itemEditors.savings.active) {
        const itemId = target.dataset.editorId;
        const field = target.dataset.field;
        if (!itemId || !field) {
          return;
        }
        const item = state.itemEditors.savings.items.find((entry) => entry.id === itemId);
        if (!item) {
          return;
        }
        if (field === "name") {
          const index = sanitizeInteger(target.dataset.index, 0, 0, 999);
          item.name = normalizeAllocationName(target.value, "저축", index);
          target.value = item.name;
        }
        if (field === "amount") {
          item.amount = sanitizeMoney(target.value, 0);
        }
        renderSavingsTotalHint(
          toWon(getMonthlyAllocationTotalMan(state.itemEditors.savings.items)),
          state.itemEditors.savings.items.length,
        );
        return;
      }

      const itemId = target.dataset.savingsId;
      if (!itemId) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      const item = draftInputs.savingsItems.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }

      item.amount = sanitizeMoney(target.value, 0);
      markPendingChanges();
    });

    dom.savingsList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !state.itemEditors.savings.active) {
        return;
      }
      const removeId = target.dataset.removeEditorItem;
      if (!removeId) {
        return;
      }
      if (state.itemEditors.savings.items.length <= 1) {
        return;
      }
      state.itemEditors.savings.items = state.itemEditors.savings.items.filter((item) => item.id !== removeId);
      renderSavingsList(state.itemEditors.savings.items, { editing: true });
      renderSavingsTotalHint(
        toWon(getMonthlyAllocationTotalMan(state.itemEditors.savings.items)),
        state.itemEditors.savings.items.length,
      );
    });
  }

  if (dom.investList) {
    dom.investList.addEventListener("input", (event) => {
      if (state.suspendInputTracking) {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (state.itemEditors.invest.active) {
        const itemId = target.dataset.editorId;
        const field = target.dataset.field;
        if (!itemId || !field) {
          return;
        }
        const item = state.itemEditors.invest.items.find((entry) => entry.id === itemId);
        if (!item) {
          return;
        }
        if (field === "name") {
          const index = sanitizeInteger(target.dataset.index, 0, 0, 999);
          item.name = normalizeAllocationName(target.value, "투자", index);
          target.value = item.name;
        }
        if (field === "amount") {
          item.amount = sanitizeMoney(target.value, 0);
        }
        renderInvestTotalHint(
          toWon(getMonthlyAllocationTotalMan(state.itemEditors.invest.items)),
          state.itemEditors.invest.items.length,
        );
        return;
      }

      const itemId = target.dataset.investId;
      if (!itemId) {
        return;
      }

      const draftInputs = ensureDraftInputs();
      const item = draftInputs.investItems.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }

      item.amount = sanitizeMoney(target.value, 0);
      markPendingChanges();
    });

    dom.investList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !state.itemEditors.invest.active) {
        return;
      }
      const removeId = target.dataset.removeEditorItem;
      if (!removeId) {
        return;
      }
      if (state.itemEditors.invest.items.length <= 1) {
        return;
      }
      state.itemEditors.invest.items = state.itemEditors.invest.items.filter((item) => item.id !== removeId);
      renderInvestList(state.itemEditors.invest.items, { editing: true });
      renderInvestTotalHint(
        toWon(getMonthlyAllocationTotalMan(state.itemEditors.invest.items)),
        state.itemEditors.invest.items.length,
      );
    });
  }

  if (dom.editExpenseItems) {
    dom.editExpenseItems.addEventListener("click", () => {
      if (state.itemEditors.expense.active) {
        cancelItemEditor("expense");
      } else {
        startItemEditor("expense");
      }
    });
  }

  if (dom.editSavingsItems) {
    dom.editSavingsItems.addEventListener("click", () => {
      if (state.itemEditors.savings.active) {
        cancelItemEditor("savings");
      } else {
        startItemEditor("savings");
      }
    });
  }

  if (dom.editInvestItems) {
    dom.editInvestItems.addEventListener("click", () => {
      if (state.itemEditors.invest.active) {
        cancelItemEditor("invest");
      } else {
        startItemEditor("invest");
      }
    });
  }

  if (dom.addExpenseItem) {
    dom.addExpenseItem.addEventListener("click", () => addItemToEditor("expense"));
  }
  if (dom.addSavingsItem) {
    dom.addSavingsItem.addEventListener("click", () => addItemToEditor("savings"));
  }
  if (dom.addInvestItem) {
    dom.addInvestItem.addEventListener("click", () => addItemToEditor("invest"));
  }

  if (dom.applyExpenseItems) {
    dom.applyExpenseItems.addEventListener("click", () => applyItemEditor("expense"));
  }
  if (dom.applySavingsItems) {
    dom.applySavingsItems.addEventListener("click", () => applyItemEditor("savings"));
  }
  if (dom.applyInvestItems) {
    dom.applyInvestItems.addEventListener("click", () => applyItemEditor("invest"));
  }

  if (dom.cancelExpenseItems) {
    dom.cancelExpenseItems.addEventListener("click", () => cancelItemEditor("expense"));
  }
  if (dom.cancelSavingsItems) {
    dom.cancelSavingsItems.addEventListener("click", () => cancelItemEditor("savings"));
  }
  if (dom.cancelInvestItems) {
    dom.cancelInvestItems.addEventListener("click", () => cancelItemEditor("invest"));
  }

  if (dom.loadSample) {
    dom.loadSample.addEventListener("click", () => {
      commitImmediateInputs({ ...SAMPLE_INPUTS });
    });
  }

  if (dom.resetInputs) {
    dom.resetInputs.addEventListener("click", () => {
      commitImmediateInputs({ ...DEFAULT_INPUTS });
    });
  }

  if (dom.applyChanges) {
    dom.applyChanges.addEventListener("click", () => {
      if (!hasPendingChanges()) {
        state.draftInputs = null;
        setPendingBarVisible(false);
        return;
      }
      state.inputs = sanitizeInputs(state.draftInputs);
      state.draftInputs = null;
      setPendingBarVisible(false);
      refreshInputsPanel(state.inputs);
      persistInputs(state.inputs);
      renderAll();
      showApplyFeedback("변경사항이 적용되었습니다.");
    });
  }

  if (dom.cancelChanges) {
    dom.cancelChanges.addEventListener("click", () => {
      if (!state.draftInputs) {
        return;
      }
      state.draftInputs = null;
      setPendingBarVisible(false);
      refreshInputsPanel(state.inputs);
      renderAll();
    });
  }

  if (dom.jumpToInputs) {
    dom.jumpToInputs.addEventListener("click", () => {
      const inputSectionTitle = document.getElementById("inputsTitle");
      if (inputSectionTitle) {
        inputSectionTitle.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  window.addEventListener("resize", debounce(() => {
    if (state.snapshot) {
      renderSankey(state.snapshot);
    }
  }, 120));
}

function ensureDraftInputs() {
  if (state.draftInputs) {
    return state.draftInputs;
  }
  state.draftInputs = cloneInputs(state.inputs);
  return state.draftInputs;
}

function getVisibleInputs() {
  return state.draftInputs || state.inputs;
}

function getItemGroupMeta(groupKey) {
  const map = {
    expense: {
      label: "생활비",
      field: "expenseItems",
      renderList: renderExpenseList,
      renderHint: renderExpenseTotalHint,
      editButton: dom.editExpenseItems,
      actionWrap: dom.expenseEditorActions,
      defaultItems: DEFAULT_EXPENSE_ITEMS,
    },
    savings: {
      label: "저축",
      field: "savingsItems",
      renderList: renderSavingsList,
      renderHint: renderSavingsTotalHint,
      editButton: dom.editSavingsItems,
      actionWrap: dom.savingsEditorActions,
      defaultItems: DEFAULT_SAVINGS_ITEMS,
    },
    invest: {
      label: "투자",
      field: "investItems",
      renderList: renderInvestList,
      renderHint: renderInvestTotalHint,
      editButton: dom.editInvestItems,
      actionWrap: dom.investEditorActions,
      defaultItems: DEFAULT_INVEST_ITEMS,
    },
  };
  return map[groupKey];
}

function setItemEditorUi(groupKey, active) {
  const meta = getItemGroupMeta(groupKey);
  if (!meta) {
    return;
  }
  if (meta.actionWrap) {
    meta.actionWrap.hidden = !active;
  }
  if (meta.editButton) {
    meta.editButton.textContent = active ? "편집 닫기" : "항목 편집";
  }
}

function startItemEditor(groupKey) {
  const meta = getItemGroupMeta(groupKey);
  const editor = state.itemEditors[groupKey];
  if (!meta || !editor) {
    return;
  }

  closeAllItemEditors(groupKey);

  const inputs = getVisibleInputs();
  const sourceItems = Array.isArray(inputs[meta.field]) && inputs[meta.field].length > 0
    ? inputs[meta.field]
    : meta.defaultItems;

  editor.active = true;
  editor.items = sourceItems.map((item, index) => ({
    id: typeof item?.id === "string" && item.id.trim()
      ? item.id.trim()
      : createAllocationItemId(groupKey, index),
    name: normalizeAllocationName(item?.name, meta.label, index),
    amount: sanitizeMoney(item?.amount, 0),
  }));

  meta.renderList(editor.items, { editing: true });
  meta.renderHint(toWon(getMonthlyAllocationTotalMan(editor.items)), editor.items.length);
  setItemEditorUi(groupKey, true);
}

function addItemToEditor(groupKey) {
  const meta = getItemGroupMeta(groupKey);
  const editor = state.itemEditors[groupKey];
  if (!meta || !editor || !editor.active || editor.items.length >= MAX_ALLOCATION_ITEMS) {
    return;
  }

  editor.items.push({
    id: createAllocationItemId(groupKey, editor.items.length),
    name: `${meta.label} ${editor.items.length + 1}`,
    amount: 0,
  });

  meta.renderList(editor.items, { editing: true });
  meta.renderHint(toWon(getMonthlyAllocationTotalMan(editor.items)), editor.items.length);
}

function applyItemEditor(groupKey) {
  const meta = getItemGroupMeta(groupKey);
  const editor = state.itemEditors[groupKey];
  if (!meta || !editor || !editor.active) {
    return;
  }

  const draftInputs = ensureDraftInputs();
  const normalizedItems = sanitizeAllocationItems(editor.items, meta.defaultItems, 0, groupKey, meta.label);
  draftInputs[meta.field] = normalizedItems;
  state.draftInputs = sanitizeInputs(draftInputs);

  editor.active = false;
  editor.items = [];
  setItemEditorUi(groupKey, false);

  meta.renderList(state.draftInputs[meta.field]);
  markPendingChanges();
}

function cancelItemEditor(groupKey) {
  const meta = getItemGroupMeta(groupKey);
  const editor = state.itemEditors[groupKey];
  if (!meta || !editor) {
    return;
  }

  editor.active = false;
  editor.items = [];
  setItemEditorUi(groupKey, false);

  const inputs = getVisibleInputs();
  const items = inputs[meta.field] || [];
  meta.renderList(items);
  meta.renderHint(toWon(getMonthlyAllocationTotalMan(items)), items.length);
}

function closeAllItemEditors(exceptGroupKey = "") {
  ["expense", "savings", "invest"].forEach((groupKey) => {
    if (groupKey === exceptGroupKey) {
      return;
    }
    const editor = state.itemEditors[groupKey];
    if (editor && editor.active) {
      cancelItemEditor(groupKey);
    } else {
      setItemEditorUi(groupKey, false);
    }
  });
}

function markPendingChanges() {
  if (!state.draftInputs) {
    return;
  }
  syncDerivedMonthlyInputs(state.draftInputs);
  renderInputHints(state.draftInputs);
  if (!hasPendingChanges()) {
    state.draftInputs = null;
    setPendingBarVisible(false);
    return;
  }
  setPendingBarVisible(true);
}

function setPendingBarVisible(visible) {
  if (!visible) {
    if (dom.pendingBar) {
      dom.pendingBar.hidden = true;
    }
    if (dom.pendingSummary) {
      dom.pendingSummary.textContent = "";
    }
    return;
  }

  const shouldShow = hasPendingChanges();
  if (dom.pendingBar) {
    dom.pendingBar.hidden = !shouldShow;
  }
  if (dom.pendingSummary) {
    dom.pendingSummary.textContent = shouldShow && state.draftInputs
      ? getPendingSummaryText(state.draftInputs)
      : "";
  }
}

function withSuspendedInputTracking(fn) {
  state.suspendInputTracking = true;
  try {
    return fn();
  } finally {
    state.suspendInputTracking = false;
  }
}

function hasPendingChanges() {
  return Boolean(state.draftInputs) && !areInputsEqual(state.draftInputs, state.inputs);
}

function areInputsEqual(a, b) {
  const left = buildInputSignature(a);
  const right = buildInputSignature(b);
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildInputSignature(inputs) {
  const safe = sanitizeInputs(cloneInputs(inputs));
  return {
    incomes: safe.incomes.map((item) => ({
      name: String(item?.name ?? "").trim().slice(0, 24),
      amount: sanitizeMoney(item?.amount, 0),
    })),
    expenseItems: safe.expenseItems.map((item) => sanitizeMoney(item?.amount, 0)),
    savingsItems: safe.savingsItems.map((item) => sanitizeMoney(item?.amount, 0)),
    investItems: safe.investItems.map((item) => sanitizeMoney(item?.amount, 0)),
    monthlyDebtPayment: safe.monthlyDebtPayment,
    startCash: safe.startCash,
    startSavings: safe.startSavings,
    startInvest: safe.startInvest,
    startDebt: safe.startDebt,
    annualIncomeGrowth: safe.annualIncomeGrowth,
    annualExpenseGrowth: safe.annualExpenseGrowth,
    annualSavingsYield: safe.annualSavingsYield,
    annualInvestReturn: safe.annualInvestReturn,
    annualDebtInterest: safe.annualDebtInterest,
    horizonYears: safe.horizonYears,
  };
}

function getPendingSummaryText(inputs) {
  const monthlyIncome = toWon(getMonthlyIncomeTotalMan(inputs.incomes));
  const monthlyOutflowMan = inputs.monthlyExpense + inputs.monthlySavings + inputs.monthlyInvest + inputs.monthlyDebtPayment;
  return `미적용 변경사항 · 월 수입 ${formatCurrency(monthlyIncome)} / 월 배분 ${formatCurrency(toWon(monthlyOutflowMan))}`;
}

function syncDerivedMonthlyInputs(inputs) {
  inputs.monthlyExpense = getMonthlyAllocationTotalMan(inputs.expenseItems);
  inputs.monthlySavings = getMonthlyAllocationTotalMan(inputs.savingsItems);
  inputs.monthlyInvest = getMonthlyAllocationTotalMan(inputs.investItems);
  syncMonthlyExpenseField(inputs.monthlyExpense);
  syncMonthlySavingsField(inputs.monthlySavings);
  syncMonthlyInvestField(inputs.monthlyInvest);
}

function renderInputHints(inputs) {
  renderIncomeTotalHint(toWon(getMonthlyIncomeTotalMan(inputs.incomes)), inputs.incomes.length);
  renderExpenseTotalHint(toWon(inputs.monthlyExpense), inputs.expenseItems.length);
  renderSavingsTotalHint(toWon(inputs.monthlySavings), inputs.savingsItems.length);
  renderInvestTotalHint(toWon(inputs.monthlyInvest), inputs.investItems.length);
}

function refreshInputsPanel(inputs) {
  closeAllItemEditors();
  withSuspendedInputTracking(() => {
    applyInputsToForm(inputs);
    renderIncomeList(inputs.incomes);
    renderExpenseList(inputs.expenseItems);
    renderSavingsList(inputs.savingsItems);
    renderInvestList(inputs.investItems);
    syncDerivedMonthlyInputs(inputs);
    renderInputHints(inputs);
  });
}

function commitImmediateInputs(nextInputs) {
  state.inputs = sanitizeInputs(nextInputs);
  state.draftInputs = null;
  setPendingBarVisible(false);
  refreshInputsPanel(state.inputs);
  persistInputs(state.inputs);
  renderAll();
}

function showApplyFeedback(message) {
  if (!dom.applyFeedback) {
    return;
  }
  if (state.applyFeedbackTimer) {
    window.clearTimeout(state.applyFeedbackTimer);
  }
  dom.applyFeedback.textContent = message;
  dom.applyFeedback.hidden = false;
  dom.applyFeedback.classList.add("is-visible");

  state.applyFeedbackTimer = window.setTimeout(() => {
    if (!dom.applyFeedback) {
      return;
    }
    dom.applyFeedback.classList.remove("is-visible");
    dom.applyFeedback.hidden = true;
    state.applyFeedbackTimer = null;
  }, 1300);
}

function renderAll() {
  syncDerivedMonthlyInputs(state.inputs);

  const snapshot = buildMonthlySnapshot(state.inputs);
  const projection = simulateProjection(state.inputs);
  const cards = buildSummaryCards(snapshot, projection, state.inputs.horizonYears);

  state.snapshot = snapshot;

  renderCards(cards, state.inputs.horizonYears);
  renderSankey(snapshot);
  renderProjectionTable(projection, state.inputs.horizonYears, state.inputs.annualExpenseGrowth);
  renderInputHints(state.inputs);
}

function buildMonthlySnapshot(inputs) {
  const income = toWon(getMonthlyIncomeTotalMan(inputs.incomes));
  const expenseBreakdown = (Array.isArray(inputs.expenseItems) ? inputs.expenseItems : [])
    .map((item, index) => ({
      id: `expense-${item?.id || index + 1}`,
      label: String(item?.name || `생활비 ${index + 1}`),
      tone: "expense",
      value: toWon(sanitizeMoney(item?.amount, 0)),
    }))
    .filter((item) => item.value > 0);
  const savingsBreakdown = (Array.isArray(inputs.savingsItems) ? inputs.savingsItems : [])
    .map((item, index) => ({
      id: `savings-${item?.id || index + 1}`,
      label: String(item?.name || `저축 ${index + 1}`),
      tone: "savings",
      value: toWon(sanitizeMoney(item?.amount, 0)),
    }))
    .filter((item) => item.value > 0);
  const investBreakdown = (Array.isArray(inputs.investItems) ? inputs.investItems : [])
    .map((item, index) => ({
      id: `invest-${item?.id || index + 1}`,
      label: String(item?.name || `투자 ${index + 1}`),
      tone: "invest",
      value: toWon(sanitizeMoney(item?.amount, 0)),
    }))
    .filter((item) => item.value > 0);
  const expense = expenseBreakdown.reduce((sum, item) => sum + item.value, 0);
  const savings = savingsBreakdown.reduce((sum, item) => sum + item.value, 0);
  const invest = investBreakdown.reduce((sum, item) => sum + item.value, 0);
  const debtPayment = toWon(inputs.monthlyDebtPayment);

  const requiredOutflow = expense + savings + invest + debtPayment;
  const netCashflow = income - requiredOutflow;
  const surplus = Math.max(0, netCashflow);
  const deficit = Math.max(0, -netCashflow);

  const targets = [
    { id: "expense", label: "생활비", tone: "expense", value: expense },
    { id: "savings", label: "저축", tone: "savings", value: savings },
    { id: "invest", label: "투자", tone: "invest", value: invest },
    { id: "debt", label: "부채상환", tone: "debt", value: debtPayment },
  ].filter((item) => item.value > 0);

  if (surplus > 0) {
    targets.push({ id: "surplus", label: "잉여현금", tone: "surplus", value: surplus });
  }

  return {
    income,
    expense,
    expenseBreakdown,
    savingsBreakdown,
    investBreakdown,
    savings,
    invest,
    debtPayment,
    requiredOutflow,
    netCashflow,
    surplus,
    deficit,
    targets,
  };
}

function simulateProjection(inputs) {
  const horizonMonths = Math.max(1, Math.round(inputs.horizonYears)) * 12;
  const monthlyIncomeBase = toWon(getMonthlyIncomeTotalMan(inputs.incomes));
  const monthlyExpenseBase = toWon(inputs.monthlyExpense);
  const monthlySavings = toWon(inputs.monthlySavings);
  const monthlyInvest = toWon(inputs.monthlyInvest);
  const monthlyDebtPayment = toWon(inputs.monthlyDebtPayment);

  const incomeFactor = toMonthlyFactor(inputs.annualIncomeGrowth);
  const expenseFactor = toMonthlyFactor(inputs.annualExpenseGrowth);
  const savingsFactor = toMonthlyFactor(inputs.annualSavingsYield);
  const investFactor = toMonthlyFactor(inputs.annualInvestReturn);
  const debtFactor = toMonthlyFactor(inputs.annualDebtInterest);
  const purchasingPowerFactor = toMonthlyFactor(inputs.annualExpenseGrowth);

  let cash = toWon(inputs.startCash);
  let savings = toWon(inputs.startSavings);
  let invest = toWon(inputs.startInvest);
  let debt = toWon(inputs.startDebt);

  const records = [
    buildProjectionRecord({
      monthIndex: 0,
      monthlyIncome: monthlyIncomeBase,
      monthlyExpense: monthlyExpenseBase,
      debtInterest: 0,
      actualDebtPayment: 0,
      newBorrowing: 0,
      cash,
      savings,
      invest,
      debt,
      realDiscountFactor: 1,
    }),
  ];

  for (let monthIndex = 1; monthIndex <= horizonMonths; monthIndex += 1) {
    const monthlyIncome = monthlyIncomeBase * Math.pow(incomeFactor, monthIndex - 1);
    const monthlyExpense = monthlyExpenseBase * Math.pow(expenseFactor, monthIndex - 1);
    const debtInterest = debt * (debtFactor - 1);
    let debtBalance = debt + debtInterest;
    let nextCash = cash + monthlyIncome;
    nextCash -= monthlyExpense;

    const payableCash = Math.max(0, nextCash);
    const actualDebtPayment = Math.min(debtBalance, monthlyDebtPayment, payableCash);
    nextCash -= actualDebtPayment;
    debtBalance -= actualDebtPayment;

    const savingsAdd = Math.min(Math.max(0, nextCash), monthlySavings);
    nextCash -= savingsAdd;
    savings += savingsAdd;

    const investAdd = Math.min(Math.max(0, nextCash), monthlyInvest);
    nextCash -= investAdd;
    invest += investAdd;

    let newBorrowing = 0;
    if (nextCash < 0) {
      newBorrowing = -nextCash;
      debtBalance += newBorrowing;
      nextCash = 0;
    }

    cash = nextCash;
    savings *= savingsFactor;
    invest *= investFactor;
    debt = debtBalance;

    records.push(
      buildProjectionRecord({
        monthIndex,
        monthlyIncome,
        monthlyExpense,
        debtInterest,
        actualDebtPayment,
        newBorrowing,
        cash,
        savings,
        invest,
        debt,
        realDiscountFactor: Math.pow(purchasingPowerFactor, monthIndex),
      }),
    );
  }

  return records;
}

function buildProjectionRecord({
  monthIndex,
  monthlyIncome,
  monthlyExpense,
  debtInterest = 0,
  actualDebtPayment = 0,
  newBorrowing = 0,
  cash,
  savings,
  invest,
  debt,
  realDiscountFactor = 1,
}) {
  const netAsset = cash + savings + invest - debt;
  const realNetAsset = netAsset / Math.max(realDiscountFactor, 1e-9);

  return {
    monthIndex,
    monthlyIncome,
    monthlyExpense,
    debtInterest,
    actualDebtPayment,
    newBorrowing,
    cash,
    savings,
    invest,
    debt,
    netAsset,
    realNetAsset,
  };
}

function buildSummaryCards(snapshot, projection, horizonYears) {
  const current = projection[0];
  const last = projection[projection.length - 1];
  const debtProbe = projection[1] || current;
  const deltaNet = last.netAsset - current.netAsset;
  const futureAllocation = snapshot.savings + snapshot.invest;
  const savingsRate = snapshot.income > 0 ? futureAllocation / snapshot.income : 0;
  const debtFreeMonth = projection.find((row) => row.monthIndex > 0 && row.debt <= 1);

  let debtFreeText = "부채 없음";
  let debtSub = "";

  if (current.debt > 0) {
    if (debtFreeMonth) {
      debtFreeText = formatMonthSpan(debtFreeMonth.monthIndex);
      debtSub = `시점: ${debtFreeMonth.monthIndex}개월`; 
    } else {
      debtFreeText = `${horizonYears}년 내 미소진`;
      debtSub = `말 잔여부채 ${formatCurrency(last.debt)}`;
    }
  }

  return [
    {
      label: "월 수입",
      value: formatCurrency(snapshot.income),
      sub: `연 ${formatCurrency(snapshot.income * 12)}`,
      variant: "positive",
    },
    {
      label: "월 총 배분",
      value: formatCurrency(snapshot.requiredOutflow),
      sub: `생활비+저축+투자+부채상환`,
      variant: "",
    },
    {
      label: "월 순현금흐름",
      value: formatSignedCurrency(snapshot.netCashflow),
      sub: snapshot.netCashflow >= 0 ? "흑자" : "적자(현금 부족분은 부채 증가)",
      variant: snapshot.netCashflow >= 0 ? "positive" : "negative",
    },
    {
      label: "당월 부채이자",
      value: formatCurrency(debtProbe.debtInterest),
      sub: debtProbe.monthIndex > 0 ? `${debtProbe.monthIndex}개월차 기준` : "현재 기준",
      variant: debtProbe.debtInterest > 0 ? "negative" : "positive",
    },
    {
      label: "당월 실제상환",
      value: formatCurrency(debtProbe.actualDebtPayment),
      sub: `설정 상환 ${formatCurrency(snapshot.debtPayment)}`,
      variant: debtProbe.actualDebtPayment > 0 ? "positive" : "",
    },
    {
      label: "당월 부채증가분",
      value: formatCurrency(debtProbe.newBorrowing),
      sub: debtProbe.newBorrowing > 0 ? "현금 부족분이 부채로 전환됨" : "부채 증가분 없음",
      variant: debtProbe.newBorrowing > 0 ? "negative" : "positive",
    },
    {
      label: "현재 순자산",
      value: formatCurrency(current.netAsset),
      sub: `현금 ${formatCurrency(current.cash)} · 부채 ${formatCurrency(current.debt)}`,
      variant: current.netAsset >= 0 ? "positive" : "negative",
    },
    {
      label: `${horizonYears}년 후 순자산`,
      value: formatCurrency(last.netAsset),
      sub: `변화 ${formatSignedCurrency(deltaNet)}`,
      variant: deltaNet >= 0 ? "positive" : "negative",
    },
    {
      label: "미래자산 투입률",
      value: formatPercent(savingsRate * 100),
      sub: `월 저축+투자 ${formatCurrency(futureAllocation)}`,
      variant: "positive",
    },
    {
      label: "부채 소진 예상",
      value: debtFreeText,
      sub: debtSub || "초기 부채가 없습니다.",
      variant: debtFreeMonth || current.debt === 0 ? "positive" : "negative",
    },
  ];
}

function renderCards(cards, horizonYears) {
  if (!dom.summaryCards) {
    return;
  }

  dom.summaryCards.innerHTML = "";
  cards.forEach((card) => {
    const item = document.createElement("article");
    item.className = `card ${card.variant || ""}`.trim();

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = card.label;

    const value = document.createElement("span");
    value.className = "value";
    value.textContent = card.value;

    const sub = document.createElement("span");
    sub.className = "sub";
    sub.textContent = card.sub;

    item.append(label, value, sub);
    dom.summaryCards.appendChild(item);
  });

  if (dom.cardMeta) {
    dom.cardMeta.textContent = `동일 엔진 계산 · ${horizonYears}년 예측 포함 · 적자 시 저축/투자 자동 축소`;
  }
}

function buildSankeyData(snapshot) {
  const level1Targets = snapshot.targets.filter((item) => item.value > 0);
  if (!level1Targets.length) {
    return null;
  }

  const totalTarget = level1Targets.reduce((sum, item) => sum + item.value, 0);
  const splitConfigs = [
    {
      parentId: "expense",
      tone: "expense",
      breakdown: (snapshot.expenseBreakdown || []).filter((item) => item.value > 0),
    },
    {
      parentId: "savings",
      tone: "savings",
      breakdown: (snapshot.savingsBreakdown || []).filter((item) => item.value > 0),
    },
    {
      parentId: "invest",
      tone: "invest",
      breakdown: (snapshot.investBreakdown || []).filter((item) => item.value > 0),
    },
  ];
  const splitGroups = splitConfigs
    .map((config) => {
      const parent = level1Targets.find((item) => item.id === config.parentId);
      if (!parent || !config.breakdown.length) {
        return null;
      }
      return {
        ...config,
        parentLabel: parent.label,
      };
    })
    .filter(Boolean);

  const nodes = [
    { id: "fund", label: "월 배분총액", tone: "income", value: totalTarget, column: 0 },
    ...level1Targets.map((item) => ({
      id: item.id,
      label: item.label,
      tone: item.tone,
      value: item.value,
      column: 1,
    })),
  ];

  splitGroups.forEach((group) => {
    nodes.push(
      ...group.breakdown.map((item) => ({
        id: `${group.parentId}-detail-${item.id}`,
        label: item.label,
        tone: group.tone,
        value: item.value,
        column: 2,
      })),
    );
  });

  const links = [
    ...level1Targets.map((target) => ({
      source: "fund",
      target: target.id,
      value: target.value,
      tone: target.tone,
    })),
  ];

  splitGroups.forEach((group) => {
    links.push(
      ...group.breakdown.map((item) => ({
        source: group.parentId,
        target: `${group.parentId}-detail-${item.id}`,
        value: item.value,
        tone: group.tone,
      })),
    );
  });

  return {
    nodes,
    links,
    splitGroups,
  };
}

function renderSankey(snapshot) {
  if (!dom.sankeySvg || !dom.sankeyWrap) {
    return;
  }

  hideSankeyTooltip();

  const data = buildSankeyData(snapshot);
  dom.sankeySvg.innerHTML = "";
  dom.sankeyLegend.innerHTML = "";

  if (!data || !data.links.length) {
    dom.sankeyEmpty.hidden = false;
    if (dom.sankeyMeta) {
      dom.sankeyMeta.textContent = "수입/배분 데이터가 없습니다.";
    }
    return;
  }

  dom.sankeyEmpty.hidden = true;

  if (dom.sankeyMeta) {
    const splitCount = Array.isArray(data.splitGroups)
      ? data.splitGroups.reduce((sum, group) => sum + group.breakdown.length, 0)
      : 0;
    const splitText = splitCount > 0 ? ` · 상세 분기 ${splitCount}개` : "";
    dom.sankeyMeta.textContent = `수입 ${formatCurrency(snapshot.income)} · 배분 ${formatCurrency(snapshot.requiredOutflow)} · 순현금흐름 ${formatSignedCurrency(snapshot.netCashflow)}${splitText}`;
  }

  const columns = [...new Set(data.nodes.map((node) => node.column))].sort((a, b) => a - b);
  const columnCount = columns.length;
  const minWidth = columnCount >= 3 ? 860 : 680;
  const width = Math.max(minWidth, dom.sankeyWrap.clientWidth - 20);
  const maxCountPerColumn = columns.reduce((max, column) => {
    const count = data.nodes.filter((node) => node.column === column).length;
    return Math.max(max, count);
  }, 1);
  const height = Math.max(320, 240 + maxCountPerColumn * 44);
  const nodeWidth = 18;
  const marginX = columnCount >= 3 ? 120 : 140;
  const marginTop = 26;
  const marginBottom = 26;
  const nodeGap = 14;

  dom.sankeySvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const inTotals = new Map();
  const outTotals = new Map();
  data.links.forEach((link) => {
    outTotals.set(link.source, (outTotals.get(link.source) || 0) + link.value);
    inTotals.set(link.target, (inTotals.get(link.target) || 0) + link.value);
  });

  const layoutNodes = data.nodes.map((node) => {
    const incoming = inTotals.get(node.id) || 0;
    const outgoing = outTotals.get(node.id) || 0;
    return {
      ...node,
      displayValue: Math.max(node.value || 0, incoming, outgoing),
    };
  });

  const scaleCandidates = columns.map((column) => {
    const nodesInColumn = layoutNodes.filter((node) => node.column === column);
    const columnValue = nodesInColumn.reduce((sum, node) => sum + node.displayValue, 0);
    const available = height - marginTop - marginBottom - nodeGap * Math.max(0, nodesInColumn.length - 1);
    return columnValue > 0 ? available / columnValue : Number.POSITIVE_INFINITY;
  });
  const scale = Math.min(...scaleCandidates);

  if (!Number.isFinite(scale) || scale <= 0) {
    dom.sankeyEmpty.hidden = false;
    return;
  }

  const step = columnCount > 1
    ? (width - marginX * 2 - nodeWidth) / (columnCount - 1)
    : 0;

  const positionedNodes = [];
  columns.forEach((column, index) => {
    const nodesInColumn = layoutNodes.filter((node) => node.column === column);
    const columnHeight = nodesInColumn.reduce((sum, node) => sum + node.displayValue * scale, 0)
      + nodeGap * Math.max(0, nodesInColumn.length - 1);
    let y = (height - columnHeight) / 2;
    const x = marginX + index * step;

    nodesInColumn.forEach((node) => {
      const h = node.displayValue * scale;
      positionedNodes.push({ ...node, x, y, h });
      y += h + nodeGap;
    });
  });

  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));
  const lastColumn = columns[columns.length - 1];

  const orderedLinks = [...data.links].sort((a, b) => {
    const sourceA = nodeMap.get(a.source);
    const sourceB = nodeMap.get(b.source);
    const targetA = nodeMap.get(a.target);
    const targetB = nodeMap.get(b.target);
    const bySourceY = (sourceA?.y || 0) - (sourceB?.y || 0);
    if (bySourceY !== 0) return bySourceY;
    return (targetA?.y || 0) - (targetB?.y || 0);
  });

  const sourceOffsets = new Map(positionedNodes.map((node) => [node.id, 0]));
  const targetOffsets = new Map(positionedNodes.map((node) => [node.id, 0]));

  orderedLinks.forEach((link) => {
    const source = nodeMap.get(link.source);
    const target = nodeMap.get(link.target);
    if (!source || !target) {
      return;
    }

    const thickness = link.value * scale;
    const sourceOffset = sourceOffsets.get(source.id) || 0;
    const targetOffset = targetOffsets.get(target.id) || 0;

    const y0 = source.y + sourceOffset;
    const y1 = y0 + thickness;
    const y2 = target.y + targetOffset;
    const y3 = y2 + thickness;

    sourceOffsets.set(source.id, sourceOffset + thickness);
    targetOffsets.set(target.id, targetOffset + thickness);

    const path = createSvgElement("path", {
      d: buildBandPath(source.x + nodeWidth, y0, y1, target.x, y2, y3),
      class: `sankey-path tone-${link.tone}`,
    });

    path.addEventListener("mousemove", (event) => {
      const splitGroup = (data.splitGroups || []).find((group) => link.target === group.parentId);
      const detailText = splitGroup
        ? formatAllocationBreakdownText(splitGroup.breakdown)
        : "";
      showSankeyTooltip(
        event,
        `${source.label} → ${target.label} · ${formatCurrency(link.value)}${detailText ? `\n${detailText}` : ""}`,
      );
    });
    path.addEventListener("mouseleave", hideSankeyTooltip);

    dom.sankeySvg.appendChild(path);
  });

  positionedNodes.forEach((node) => {
    const side = node.column === lastColumn ? "target" : "source";
    drawNode(node, side, nodeWidth);
  });

  renderSankeyLegend(data);
}

function drawNode(node, side, nodeWidth) {
  const rect = createSvgElement("rect", {
    x: node.x,
    y: node.y,
    width: nodeWidth,
    height: Math.max(1, node.h),
    class: `sankey-node tone-${node.tone}`,
  });
  dom.sankeySvg.appendChild(rect);

  const labelX = side === "source" ? node.x - 10 : node.x + nodeWidth + 10;
  const anchor = side === "source" ? "end" : "start";
  const centerY = node.y + node.h / 2;

  const label = createSvgElement("text", {
    x: labelX,
    y: centerY - 6,
    class: "sankey-label",
    "text-anchor": anchor,
    "dominant-baseline": "middle",
  });
  label.textContent = node.label;

  const value = createSvgElement("text", {
    x: labelX,
    y: centerY + 10,
    class: "sankey-value",
    "text-anchor": anchor,
    "dominant-baseline": "middle",
  });
  value.textContent = formatCurrency(node.value);

  dom.sankeySvg.appendChild(label);
  dom.sankeySvg.appendChild(value);
}

function renderSankeyLegend(data) {
  const items = data.nodes
    .filter((node) => node.column === 1)
    .map((node) => ({
      id: node.id,
      label: node.label,
      tone: node.tone,
      value: node.value,
    }));

  (data.splitGroups || []).forEach((group) => {
    group.breakdown.forEach((item) => {
      items.push({
        id: `${group.parentId}-detail-${item.id}`,
        label: `${group.parentLabel} · ${item.label}`,
        tone: group.tone,
        value: item.value,
        isDetail: true,
      });
    });
  });

  items.forEach((item) => {
    const chip = document.createElement("span");
    chip.className = `legend-item${item.isDetail ? " legend-item--detail" : ""}`;

    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.backgroundColor = TONE_COLORS[item.tone] || "#999";

    const label = document.createElement("span");
    label.textContent = `${item.label} ${formatCurrency(item.value)}`;

    chip.append(dot, label);
    dom.sankeyLegend.appendChild(chip);
  });
}

function renderProjectionTable(records, horizonYears, annualBaseRate) {
  if (!dom.projectionTableBody) {
    return;
  }

  const yearlyRows = records.filter((row) => row.monthIndex % 12 === 0);
  dom.projectionTableBody.innerHTML = "";

  yearlyRows.forEach((row) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${row.monthIndex === 0 ? "현재" : `${row.monthIndex / 12}년`}</td>
      <td>${formatCurrency(row.monthlyIncome)}</td>
      <td>${formatCurrency(row.monthlyExpense)}</td>
      <td>${formatCurrency(row.debtInterest)}</td>
      <td>${formatCurrency(row.actualDebtPayment)}</td>
      <td>${formatCurrency(row.newBorrowing)}</td>
      <td>${formatCurrency(row.cash)}</td>
      <td>${formatCurrency(row.savings)}</td>
      <td>${formatCurrency(row.invest)}</td>
      <td>${formatCurrency(row.debt)}</td>
      <td>${formatCurrency(row.netAsset)}</td>
      <td>${formatCurrency(row.realNetAsset)}</td>
    `;

    dom.projectionTableBody.appendChild(tr);
  });

  if (dom.projectionMeta) {
    const firstMonth = records.find((row) => row.monthIndex === 1);
    const debtHint = firstMonth && firstMonth.debtInterest > firstMonth.actualDebtPayment
      ? " 첫 달 기준 이자 > 실제상환이면 부채가 증가할 수 있습니다."
      : "";
    dom.projectionMeta.textContent = `월 단위 ${records.length - 1}회 계산 결과를 연 단위 스냅샷으로 요약했습니다 (${horizonYears}년). 실질 순자산은 기준금리 ${formatPercent(annualBaseRate)}를 디플레이터로 사용합니다.${debtHint}`;
  }
}

function renderIncomeList(incomes) {
  if (!dom.incomeList) {
    return;
  }

  dom.incomeList.innerHTML = "";

  incomes.forEach((income, index) => {
    const row = document.createElement("div");
    row.className = "income-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "수입명";
    nameInput.value = income.name;
    nameInput.setAttribute("aria-label", `수입 항목 ${index + 1} 이름`);
    nameInput.dataset.incomeId = income.id;
    nameInput.dataset.field = "name";

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(income.amount);
    amountInput.setAttribute("aria-label", `수입 항목 ${index + 1} 금액`);
    amountInput.dataset.incomeId = income.id;
    amountInput.dataset.field = "amount";

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-ghost btn-sm income-remove";
    removeButton.textContent = "삭제";
    removeButton.dataset.removeIncome = income.id;
    removeButton.disabled = incomes.length <= 1;

    row.append(nameInput, amountInput, removeButton);
    dom.incomeList.appendChild(row);
  });

  if (dom.addIncomeItem) {
    dom.addIncomeItem.disabled = incomes.length >= MAX_INCOME_ITEMS;
  }
}

function renderIncomeTotalHint(monthlyIncomeWon, count) {
  if (!dom.incomeTotalHint) {
    return;
  }
  dom.incomeTotalHint.textContent = `현재 수입 항목 ${count}개 · 월 수입 합계 ${formatCurrency(monthlyIncomeWon)}`;
}

function renderExpenseList(expenseItems, options = {}) {
  if (!dom.expenseList) {
    return;
  }

  dom.expenseList.innerHTML = "";
  const editing = Boolean(options.editing);

  expenseItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `expense-row${editing ? " is-editing" : ""}`;

    let nameElement;
    if (editing) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = item.name;
      nameInput.maxLength = 24;
      nameInput.placeholder = "항목명";
      nameInput.className = "expense-name-input";
      nameInput.dataset.editorId = item.id;
      nameInput.dataset.field = "name";
      nameInput.dataset.index = String(index);
      nameElement = nameInput;
    } else {
      const name = document.createElement("span");
      name.className = "expense-name";
      name.textContent = item.name;
      nameElement = name;
    }

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(item.amount);
    amountInput.setAttribute("aria-label", `${item.name} 금액`);
    if (editing) {
      amountInput.dataset.editorId = item.id;
      amountInput.dataset.field = "amount";
    } else {
      amountInput.dataset.expenseId = item.id;
    }
    amountInput.dataset.index = String(index);

    row.append(nameElement, amountInput);

    if (editing) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-ghost btn-sm allocation-remove";
      removeButton.dataset.removeEditorItem = item.id;
      removeButton.textContent = "삭제";
      row.appendChild(removeButton);
    }

    dom.expenseList.appendChild(row);
  });
}

function renderSavingsList(savingsItems, options = {}) {
  if (!dom.savingsList) {
    return;
  }

  dom.savingsList.innerHTML = "";
  const editing = Boolean(options.editing);

  savingsItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `savings-row${editing ? " is-editing" : ""}`;

    let nameElement;
    if (editing) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = item.name;
      nameInput.maxLength = 24;
      nameInput.placeholder = "항목명";
      nameInput.className = "savings-name-input";
      nameInput.dataset.editorId = item.id;
      nameInput.dataset.field = "name";
      nameInput.dataset.index = String(index);
      nameElement = nameInput;
    } else {
      const name = document.createElement("span");
      name.className = "savings-name";
      name.textContent = item.name;
      nameElement = name;
    }

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(item.amount);
    amountInput.setAttribute("aria-label", `${item.name} 금액`);
    if (editing) {
      amountInput.dataset.editorId = item.id;
      amountInput.dataset.field = "amount";
    } else {
      amountInput.dataset.savingsId = item.id;
    }
    amountInput.dataset.index = String(index);

    row.append(nameElement, amountInput);

    if (editing) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-ghost btn-sm allocation-remove";
      removeButton.dataset.removeEditorItem = item.id;
      removeButton.textContent = "삭제";
      row.appendChild(removeButton);
    }

    dom.savingsList.appendChild(row);
  });
}

function renderInvestList(investItems, options = {}) {
  if (!dom.investList) {
    return;
  }

  dom.investList.innerHTML = "";
  const editing = Boolean(options.editing);

  investItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `invest-row${editing ? " is-editing" : ""}`;

    let nameElement;
    if (editing) {
      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = item.name;
      nameInput.maxLength = 24;
      nameInput.placeholder = "항목명";
      nameInput.className = "invest-name-input";
      nameInput.dataset.editorId = item.id;
      nameInput.dataset.field = "name";
      nameInput.dataset.index = String(index);
      nameElement = nameInput;
    } else {
      const name = document.createElement("span");
      name.className = "invest-name";
      name.textContent = item.name;
      nameElement = name;
    }

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "0";
    amountInput.step = "1";
    amountInput.placeholder = "금액(만원)";
    amountInput.value = String(item.amount);
    amountInput.setAttribute("aria-label", `${item.name} 금액`);
    if (editing) {
      amountInput.dataset.editorId = item.id;
      amountInput.dataset.field = "amount";
    } else {
      amountInput.dataset.investId = item.id;
    }
    amountInput.dataset.index = String(index);

    row.append(nameElement, amountInput);

    if (editing) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-ghost btn-sm allocation-remove";
      removeButton.dataset.removeEditorItem = item.id;
      removeButton.textContent = "삭제";
      row.appendChild(removeButton);
    }

    dom.investList.appendChild(row);
  });
}

function renderExpenseTotalHint(monthlyExpenseWon, count) {
  if (!dom.expenseTotalHint) {
    return;
  }
  dom.expenseTotalHint.textContent = `생활비 항목 ${count}개 · 월 생활비 합계 ${formatCurrency(monthlyExpenseWon)}`;
}

function renderSavingsTotalHint(monthlySavingsWon, count) {
  if (!dom.savingsTotalHint) {
    return;
  }
  dom.savingsTotalHint.textContent = `저축 항목 ${count}개 · 월 저축 합계 ${formatCurrency(monthlySavingsWon)}`;
}

function renderInvestTotalHint(monthlyInvestWon, count) {
  if (!dom.investTotalHint) {
    return;
  }
  dom.investTotalHint.textContent = `투자 항목 ${count}개 · 월 투자 합계 ${formatCurrency(monthlyInvestWon)}`;
}

function syncMonthlyExpenseField(monthlyExpenseMan) {
  const field = dom.inputsForm?.elements?.monthlyExpense;
  if (field) {
    field.value = String(sanitizeMoney(monthlyExpenseMan, 0));
  }
}

function syncMonthlySavingsField(monthlySavingsMan) {
  const field = dom.inputsForm?.elements?.monthlySavings;
  if (field) {
    field.value = String(sanitizeMoney(monthlySavingsMan, 0));
  }
}

function syncMonthlyInvestField(monthlyInvestMan) {
  const field = dom.inputsForm?.elements?.monthlyInvest;
  if (field) {
    field.value = String(sanitizeMoney(monthlyInvestMan, 0));
  }
}

function readInputsFromForm(baseInputs = state.inputs) {
  const raw = {
    incomes: baseInputs.incomes,
    expenseItems: baseInputs.expenseItems,
    savingsItems: baseInputs.savingsItems,
    investItems: baseInputs.investItems,
    monthlyExpense: baseInputs.monthlyExpense,
    monthlySavings: baseInputs.monthlySavings,
    monthlyInvest: baseInputs.monthlyInvest,
  };

  FORM_FIELD_KEYS.forEach((key) => {
    const field = dom.inputsForm?.elements?.[key];
    raw[key] = Number(field?.value);
  });

  return raw;
}

function applyInputsToForm(inputs) {
  FORM_FIELD_KEYS.forEach((key) => {
    const field = dom.inputsForm?.elements?.[key];
    if (field) {
      field.value = String(inputs[key]);
    }
  });
}

function sanitizeInputs(raw) {
  const monthlyIncomeFallback = sanitizeMoney(raw.monthlyIncome, getMonthlyIncomeTotalMan(DEFAULT_INPUTS.incomes));
  const monthlyExpenseFallback = sanitizeMoney(raw.monthlyExpense, getMonthlyAllocationTotalMan(DEFAULT_EXPENSE_ITEMS));
  const monthlySavingsFallback = sanitizeMoney(raw.monthlySavings, getMonthlyAllocationTotalMan(DEFAULT_SAVINGS_ITEMS));
  const monthlyInvestFallback = sanitizeMoney(raw.monthlyInvest, getMonthlyAllocationTotalMan(DEFAULT_INVEST_ITEMS));
  const expenseItems = sanitizeExpenseItems(raw.expenseItems, monthlyExpenseFallback);
  const savingsItems = sanitizeSavingsItems(raw.savingsItems, monthlySavingsFallback);
  const investItems = sanitizeInvestItems(raw.investItems, monthlyInvestFallback);

  return {
    incomes: sanitizeIncomeItems(raw.incomes, monthlyIncomeFallback),
    expenseItems,
    savingsItems,
    investItems,
    monthlyExpense: getMonthlyAllocationTotalMan(expenseItems),
    monthlySavings: getMonthlyAllocationTotalMan(savingsItems),
    monthlyInvest: getMonthlyAllocationTotalMan(investItems),
    monthlyDebtPayment: sanitizeMoney(raw.monthlyDebtPayment, DEFAULT_INPUTS.monthlyDebtPayment),
    startCash: sanitizeMoney(raw.startCash, DEFAULT_INPUTS.startCash),
    startSavings: sanitizeMoney(raw.startSavings, DEFAULT_INPUTS.startSavings),
    startInvest: sanitizeMoney(raw.startInvest, DEFAULT_INPUTS.startInvest),
    startDebt: sanitizeMoney(raw.startDebt, DEFAULT_INPUTS.startDebt),
    annualIncomeGrowth: sanitizeRate(raw.annualIncomeGrowth, DEFAULT_INPUTS.annualIncomeGrowth, 30),
    annualExpenseGrowth: sanitizeRate(raw.annualExpenseGrowth, DEFAULT_INPUTS.annualExpenseGrowth, 30),
    annualSavingsYield: sanitizeRate(raw.annualSavingsYield, DEFAULT_INPUTS.annualSavingsYield, 20),
    annualInvestReturn: sanitizeRate(raw.annualInvestReturn, DEFAULT_INPUTS.annualInvestReturn, 30),
    annualDebtInterest: sanitizeRate(raw.annualDebtInterest, DEFAULT_INPUTS.annualDebtInterest, 30),
    horizonYears: sanitizeInteger(raw.horizonYears, DEFAULT_INPUTS.horizonYears, 1, 40),
  };
}

function sanitizeIncomeItems(items, fallbackAmount) {
  if (!Array.isArray(items) || items.length === 0) {
    return [createIncomeItem({ name: "급여", amount: fallbackAmount })];
  }

  const sanitized = items
    .map((item, index) => {
      const safeItem = item && typeof item === "object" ? item : {};
      const safeName = normalizeIncomeName(safeItem.name, index);
      const safeAmount = sanitizeMoney(safeItem.amount, 0);
      const safeId = typeof safeItem.id === "string" && safeItem.id.trim()
        ? safeItem.id.trim()
        : createIncomeId();
      return {
        id: safeId,
        name: safeName,
        amount: safeAmount,
      };
    })
    .filter((item) => item.name || item.amount > 0)
    .slice(0, MAX_INCOME_ITEMS);

  if (sanitized.length > 0) {
    return sanitized;
  }

  return [createIncomeItem({ name: "급여", amount: fallbackAmount })];
}

function normalizeIncomeName(name, index) {
  const text = String(name ?? "").trim();
  if (!text) {
    return `수입 ${index + 1}`;
  }
  return text.slice(0, 24);
}

function createIncomeId() {
  return `income-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function createIncomeItem({ id, name, amount } = {}) {
  return {
    id: typeof id === "string" && id.trim() ? id.trim() : createIncomeId(),
    name: normalizeIncomeName(name, 0),
    amount: sanitizeMoney(amount, 0),
  };
}

function getMonthlyIncomeTotalMan(incomes) {
  if (!Array.isArray(incomes)) {
    return 0;
  }
  return incomes.reduce((sum, income) => sum + sanitizeMoney(income?.amount, 0), 0);
}

function sanitizeExpenseItems(items, fallbackAmount) {
  return sanitizeAllocationItems(items, DEFAULT_EXPENSE_ITEMS, fallbackAmount, "expense", "생활비");
}

function sanitizeSavingsItems(items, fallbackAmount) {
  return sanitizeAllocationItems(items, DEFAULT_SAVINGS_ITEMS, fallbackAmount, "savings", "저축");
}

function sanitizeInvestItems(items, fallbackAmount) {
  return sanitizeAllocationItems(items, DEFAULT_INVEST_ITEMS, fallbackAmount, "invest", "투자");
}

function sanitizeAllocationItems(items, defaultItems, fallbackAmount, prefix = "allocation", label = "항목") {
  if (!Array.isArray(items) || items.length === 0) {
    return scaleDefaultAllocationItemsToTotal(defaultItems, fallbackAmount);
  }

  const usedIds = new Set();
  const sanitized = items
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      let safeId = typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : createAllocationItemId(prefix, index);
      if (usedIds.has(safeId)) {
        safeId = createAllocationItemId(prefix, index);
      }
      usedIds.add(safeId);

      return {
        id: safeId,
        name: normalizeAllocationName(item.name, label, index),
        amount: sanitizeMoney(item.amount, 0),
      };
    })
    .filter((item) => item.name || item.amount > 0)
    .slice(0, MAX_ALLOCATION_ITEMS);

  if (sanitized.length > 0) {
    return sanitized;
  }

  return scaleDefaultAllocationItemsToTotal(defaultItems, fallbackAmount);
}

function createAllocationItemId(prefix, index = 0) {
  return `${prefix}-${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`;
}

function normalizeAllocationName(name, label, index) {
  const text = String(name ?? "").trim();
  if (!text) {
    return `${label} ${index + 1}`;
  }
  return text.slice(0, 24);
}

function scaleDefaultAllocationItemsToTotal(defaultItems, totalAmount) {
  const safeTotal = sanitizeMoney(totalAmount, getMonthlyAllocationTotalMan(defaultItems));
  const baseTotal = getMonthlyAllocationTotalMan(defaultItems);

  if (baseTotal <= 0) {
    return defaultItems.map((item) => ({ ...item, amount: 0 }));
  }

  const factor = safeTotal / baseTotal;
  const scaled = defaultItems.map((item) => ({
    id: item.id,
    name: item.name,
    amount: sanitizeMoney(item.amount * factor, 0),
  }));

  const currentTotal = getMonthlyAllocationTotalMan(scaled);
  const diff = safeTotal - currentTotal;
  const targetIndex = scaled.length - 1;
  scaled[targetIndex].amount = Math.max(0, scaled[targetIndex].amount + diff);

  return scaled;
}

function getMonthlyAllocationTotalMan(items) {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.reduce((sum, item) => sum + sanitizeMoney(item?.amount, 0), 0);
}

function sanitizeMoney(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(0, Math.round(number));
}

function sanitizeRate(value, fallback, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return roundTo(Math.min(Math.max(number, 0), max), 1);
}

function sanitizeInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

function toWon(manValue) {
  return Number(manValue) * MONEY_UNIT;
}

function toMonthlyFactor(annualPercent) {
  const annualRate = Number(annualPercent) / 100;
  return Math.pow(1 + annualRate, 1 / 12);
}

function formatCurrency(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return currencyFormatter.format(Math.round(safeValue));
}

function formatSignedCurrency(value) {
  if (!Number.isFinite(value)) {
    return formatCurrency(0);
  }
  if (value < 0) {
    return `-${formatCurrency(Math.abs(value))}`;
  }
  return `+${formatCurrency(value)}`;
}

function formatPercent(percent) {
  const safe = Number.isFinite(percent) ? percent : 0;
  return `${roundTo(safe, 1).toLocaleString("ko-KR")} %`;
}

function formatMonthSpan(months) {
  const year = Math.floor(months / 12);
  const month = months % 12;

  if (year <= 0) {
    return `${month}개월`;
  }
  if (month === 0) {
    return `${year}년`;
  }
  return `${year}년 ${month}개월`;
}

function formatAllocationBreakdownText(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }
  return items
    .map((item) => `${item.label} ${formatCurrency(item.value)}`)
    .join("\n");
}

function buildBandPath(x0, y0, y1, x1, y2, y3) {
  const curve = Math.max(40, (x1 - x0) * 0.42);
  return [
    `M ${x0} ${y0}`,
    `C ${x0 + curve} ${y0}, ${x1 - curve} ${y2}, ${x1} ${y2}`,
    `L ${x1} ${y3}`,
    `C ${x1 - curve} ${y3}, ${x0 + curve} ${y1}, ${x0} ${y1}`,
    "Z",
  ].join(" ");
}

function createSvgElement(tagName, attrs) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.setAttribute(key, String(value));
    }
  });
  return element;
}

function showSankeyTooltip(event, text) {
  if (!dom.sankeyTooltip || !dom.sankeyWrap) {
    return;
  }

  const wrapRect = dom.sankeyWrap.getBoundingClientRect();
  const tooltip = dom.sankeyTooltip;

  tooltip.hidden = false;
  tooltip.textContent = text;

  const maxX = Math.max(20, wrapRect.width - 250);
  const maxY = Math.max(20, wrapRect.height - 70);
  const x = Math.min(maxX, event.clientX - wrapRect.left + 12);
  const y = Math.min(maxY, event.clientY - wrapRect.top + 12);

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function hideSankeyTooltip() {
  if (dom.sankeyTooltip) {
    dom.sankeyTooltip.hidden = true;
  }
}

function cloneInputs(inputs) {
  if (typeof structuredClone === "function") {
    return structuredClone(inputs);
  }
  return JSON.parse(JSON.stringify(inputs));
}

function persistInputs(inputs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch (_error) {
    // Ignore storage errors to keep UI functional.
  }
}

function loadPersistedInputs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function roundTo(value, digit) {
  const factor = 10 ** digit;
  return Math.round(value * factor) / factor;
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
