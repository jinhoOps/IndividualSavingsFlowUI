import { IsfUtils } from "../../../shared/core/utils.js";

import { dom } from "./dom.js";
import {
  buildHouseholdBudgetSummary,
  buildVariableExpenseBudgetRows,
  HOUSEHOLD_INCOME_MODES,
} from "./household-budget.js";
import { sanitizeHouseholdContext } from "./input-sanitizer.js";
import { state } from "./state.js";

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function safeItems(items) {
  return Array.isArray(items) ? items : [];
}

function parseWon(value) {
  return IsfUtils.sanitizeMoney(value, 0, 0);
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

export function createHouseholdBudgetController({ persistence, getVisibleInputs, renderAll } = {}) {
  let baselineInputs = null;
  let draftInputs = null;

  function getInputs() {
    return typeof getVisibleInputs === "function" ? getVisibleInputs() : state.inputs;
  }

  function syncModeButtons() {
    const mode = draftInputs?.householdContext?.incomeMode || HOUSEHOLD_INCOME_MODES.single;
    [
      [dom.householdIncomeModeSingle, HOUSEHOLD_INCOME_MODES.single],
      [dom.householdIncomeModeDual, HOUSEHOLD_INCOME_MODES.dual],
    ].forEach(([button, buttonMode]) => {
      if (!button) return;
      const active = mode === buttonMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (dom.spouseMonthlyIncome) {
      dom.spouseMonthlyIncome.disabled = mode !== HOUSEHOLD_INCOME_MODES.dual;
      dom.spouseMonthlyIncome.value = String(draftInputs.householdContext.spouseMonthlyIncome || "");
    }
  }

  function renderSummary() {
    if (!dom.householdBudgetModalSummary || !draftInputs) return;
    const summary = buildHouseholdBudgetSummary(draftInputs);
    const metrics = document.createElement("div");
    metrics.className = "household-budget-modal-summary__metrics";
    summary.metrics.forEach((metric) => {
      const item = document.createElement("article");
      item.className = "household-budget-modal-summary__metric";
      item.appendChild(createTextElement("span", "", metric.label));
      item.appendChild(createTextElement("strong", "", metric.value));
      metrics.appendChild(item);
    });
    const projection = createTextElement(
      "p",
      "household-budget-modal-summary__projection",
      `월말 예상 ${IsfUtils.formatMoney(summary.projectedMonthEnd)} · ${summary.projectionNote}`,
    );
    dom.householdBudgetModalSummary.replaceChildren(metrics, projection);
  }

  function updateExpenseItem(id, field, value) {
    if (!draftInputs) return;
    draftInputs.expenseItems = safeItems(draftInputs.expenseItems).map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        [field]: parseWon(value),
      };
    });
    render();
  }

  function renderRows() {
    if (!dom.householdBudgetRows || !draftInputs) return;
    const rows = buildVariableExpenseBudgetRows(draftInputs);
    if (dom.householdBudgetEmpty) {
      dom.householdBudgetEmpty.hidden = rows.length > 0;
    }
    dom.householdBudgetRows.replaceChildren(...rows.map((row) => {
      const item = document.createElement("article");
      item.className = "household-budget-row";
      item.dataset.householdBudgetRow = row.id;

      const head = document.createElement("div");
      head.className = "household-budget-row__head";
      head.appendChild(createTextElement("strong", "", row.name));
      const status = createTextElement("span", "household-budget-status", row.status);
      status.dataset.householdBudgetStatus = row.status;
      head.appendChild(status);

      const fields = document.createElement("div");
      fields.className = "household-budget-row__fields";

      const targetLabel = document.createElement("label");
      targetLabel.className = "household-budget-field";
      targetLabel.appendChild(createTextElement("span", "", "목표"));
      const targetInput = document.createElement("input");
      targetInput.type = "text";
      targetInput.inputMode = "numeric";
      targetInput.dataset.householdBudgetTarget = row.id;
      targetInput.dataset.moneyInput = "won";
      targetInput.value = String(row.target || "");
      targetLabel.appendChild(targetInput);

      const actualLabel = document.createElement("label");
      actualLabel.className = "household-budget-field";
      actualLabel.appendChild(createTextElement("span", "", "실제"));
      const actualInput = document.createElement("input");
      actualInput.type = "text";
      actualInput.inputMode = "numeric";
      actualInput.dataset.householdBudgetActual = row.id;
      actualInput.dataset.moneyInput = "won";
      actualInput.value = String(row.actual || "");
      actualLabel.appendChild(actualInput);

      const meta = createTextElement("p", "household-budget-row__meta", `남은 금액 ${row.remainingLabel} · 월말 예상 ${row.projectedMonthEndLabel}`);

      fields.append(targetLabel, actualLabel);
      item.append(head, fields, meta);
      return item;
    }));
  }

  function render() {
    if (!draftInputs) return;
    syncModeButtons();
    renderSummary();
    renderRows();
    IsfUtils.updateAllKoreanWonHints(dom.householdBudgetModal || document);
  }

  function open() {
    if (!dom.householdBudgetModal) return;
    baselineInputs = clone(getInputs());
    draftInputs = {
      ...clone(baselineInputs),
      householdContext: sanitizeHouseholdContext(baselineInputs.householdContext),
      expenseItems: clone(safeItems(baselineInputs.expenseItems)),
    };
    dom.householdBudgetModal.hidden = false;
    window.requestAnimationFrame(() => {
      dom.householdBudgetModal.classList.add("is-active");
    });
    render();
  }

  function close() {
    if (!dom.householdBudgetModal) return;
    dom.householdBudgetModal.classList.remove("is-active");
    baselineInputs = null;
    draftInputs = null;
    window.setTimeout(() => {
      dom.householdBudgetModal.hidden = true;
    }, 200);
  }

  function save() {
    if (!draftInputs || !baselineInputs || !persistence) return;
    persistence.commitImmediateInputs({
      ...baselineInputs,
      householdContext: draftInputs.householdContext,
      expenseItems: draftInputs.expenseItems,
    });
    if (typeof renderAll === "function") {
      renderAll();
    }
    close();
  }

  function setIncomeMode(mode) {
    if (!draftInputs) return;
    draftInputs.householdContext = sanitizeHouseholdContext({
      ...draftInputs.householdContext,
      incomeMode: mode,
    });
    render();
  }

  function bind() {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-household-budget-action='open']")) {
        event.preventDefault();
        open();
      }
    });
    dom.householdBudgetClose?.addEventListener("click", close);
    dom.householdBudgetCancel?.addEventListener("click", close);
    dom.householdBudgetSave?.addEventListener("click", save);
    dom.householdIncomeModeSingle?.addEventListener("click", () => setIncomeMode(HOUSEHOLD_INCOME_MODES.single));
    dom.householdIncomeModeDual?.addEventListener("click", () => setIncomeMode(HOUSEHOLD_INCOME_MODES.dual));
    dom.spouseMonthlyIncome?.addEventListener("input", () => {
      if (!draftInputs) return;
      draftInputs.householdContext = sanitizeHouseholdContext({
        ...draftInputs.householdContext,
        spouseMonthlyIncome: dom.spouseMonthlyIncome.value,
      });
      renderSummary();
    });
    dom.householdBudgetRows?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.dataset.householdBudgetTarget) {
        updateExpenseItem(target.dataset.householdBudgetTarget, "amount", target.value);
      } else if (target.dataset.householdBudgetActual) {
        updateExpenseItem(target.dataset.householdBudgetActual, "actualSpent", target.value);
      }
    });
  }

  return {
    bind,
    open,
    close,
    save,
  };
}
