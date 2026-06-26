import { cloneInputs, sanitizeInputs } from "./input-sanitizer.js";




export function createEmptyDraft(baseInputs) {
  return sanitizeInputs(cloneInputs(baseInputs));
}


export function ensureDraftInputs(state) {
  return state.inputs;
}


export function getVisibleInputs(state) {
  return state.inputs;
}


export function markDirty(state) {
  // Auto-save: no action needed
}


export function markClean(state) {
  state.draftInputs = null;
}


export function hasPendingChanges(state) {
  return false;
}


export function getAccountById(inputs, id) {
  if (!id) return null;
  const groups = [inputs.incomes, inputs.expenseItems, inputs.savingsItems, inputs.investItems];
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    const found = group.find(item => item.id === id);
    if (found) return found;
  }
  return null;
}


export function resetState(state, defaultInputs) {
  state.inputs = sanitizeInputs(cloneInputs(defaultInputs));
  state.draftInputs = null;
  state.isDashboardMode = false;
}


export function updateDraftField(state, key, value) {
  state.inputs[key] = value;
  return state.inputs;
}


export function syncDerivedValues(inputs, { getMonthlyAllocationTotalWon }) {
  inputs.monthlyExpense = getMonthlyAllocationTotalWon(inputs.expenseItems);
  inputs.monthlySavings = getMonthlyAllocationTotalWon(inputs.savingsItems);
  inputs.monthlyInvest = getMonthlyAllocationTotalWon(inputs.investItems);
}


export function readInputsFromForm(form, baseInputs, { FORM_FIELD_KEYS, toWon }) {
  const raw = cloneInputs(baseInputs);
  if (!form) return raw;
  
  FORM_FIELD_KEYS.forEach(key => {
    const field = form.elements[key];
    if (!field) return;
    const value = field.value;
    const wonFields = ["monthlyExpense", "monthlySavings", "monthlyInvest", "monthlyDebtPayment", "startCash", "startSavings", "startInvest", "startDebt"];
    
    if (wonFields.includes(key)) {
      raw[key] = toWon(value);
    } else {
      raw[key] = Number(value);
    }
  });

  const surplusField = form.elements["surplusTransferAccountId"] || form.elements["surplusTransferAccountSelect"];
  if (surplusField) {
    raw.surplusTransferAccountId = surplusField.value;
  }

  return raw;
}


export function applyInputsToForm(form, inputs, { FORM_FIELD_KEYS, toMan }) {
  if (!form) return;
  const activeElement = form.ownerDocument ? form.ownerDocument.activeElement : null;
  FORM_FIELD_KEYS.forEach(key => {
    const field = form.elements[key];
    if (!field) return;
    const wonFields = ["monthlyExpense", "monthlySavings", "monthlyInvest", "monthlyDebtPayment", "startCash", "startSavings", "startInvest", "startDebt"];
    
    if (wonFields.includes(key)) {
      const value = toMan(inputs[key]);
      if (field === activeElement && field.dataset.moneyInput === "won") {
        return;
      }
      field.value = window.IsfUtils && typeof window.IsfUtils.formatWonInputValue === "function"
        ? window.IsfUtils.formatWonInputValue(value)
        : String(value);
      field.dataset.moneyInput = "won";
    } else {
      field.value = String(inputs[key]);
    }
  });

  const surplusField = form.elements["surplusTransferAccountId"] || form.elements["surplusTransferAccountSelect"];
  if (surplusField && inputs.surplusTransferAccountId) {
    surplusField.value = inputs.surplusTransferAccountId;
  }
}



