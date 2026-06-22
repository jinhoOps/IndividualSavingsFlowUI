import { IsfUtils } from "../../../shared/core/utils.js";

import {
  getMonthlyAllocationTotalWon,
  getMonthlyIncomeTotalWon,
  isVariableExpenseItem,
} from "./input-sanitizer.js";

export const HOUSEHOLD_INCOME_MODES = {
  single: "single-income",
  dual: "dual-income",
};

export const BUDGET_STATUS_LABELS = {
  safe: "여유",
  caution: "주의",
  over: "초과",
};

export const HOUSEHOLD_PROJECTION_NOTE = "현재 사용 속도를 단순 환산한 참고값입니다.";

function safeMoney(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function getDaysInMonth(now) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function getElapsedDay(now) {
  const day = Number(now?.getDate?.() || 1);
  const daysInMonth = getDaysInMonth(now instanceof Date ? now : new Date());
  return Math.min(Math.max(1, day), daysInMonth);
}

export function projectMonthEndSpending(actualSpent, now = new Date()) {
  const date = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const actual = safeMoney(actualSpent);
  if (actual <= 0) {
    return 0;
  }
  const projected = Math.round((actual / getElapsedDay(date)) * getDaysInMonth(date));
  return Number.isFinite(projected) ? Math.max(0, projected) : 0;
}

export function resolveBudgetStatus({ target, actual, projected } = {}) {
  const safeTarget = safeMoney(target);
  const safeActual = safeMoney(actual);
  const safeProjected = safeMoney(projected);
  if (safeTarget <= 0) {
    return safeActual > 0 ? BUDGET_STATUS_LABELS.over : BUDGET_STATUS_LABELS.safe;
  }
  if (safeActual > safeTarget) {
    return BUDGET_STATUS_LABELS.over;
  }
  if (safeProjected > safeTarget || safeActual / safeTarget >= 0.8) {
    return BUDGET_STATUS_LABELS.caution;
  }
  return BUDGET_STATUS_LABELS.safe;
}

export function buildVariableExpenseBudgetRows(inputs, now = new Date()) {
  const expenses = Array.isArray(inputs?.expenseItems) ? inputs.expenseItems : [];
  return expenses
    .filter(isVariableExpenseItem)
    .map((item) => {
      const target = safeMoney(item.amount);
      const actual = safeMoney(item.actualSpent);
      const projectedMonthEnd = projectMonthEndSpending(actual, now);
      const remaining = target - actual;
      const progressRate = target > 0 ? Math.min(actual / target, 1) : 0;
      const status = resolveBudgetStatus({ target, actual, projected: projectedMonthEnd });

      return {
        id: item.id,
        name: item.name || item.id || "변동비",
        group: item.group || "변동비",
        target,
        actual,
        remaining,
        progressRate,
        projectedMonthEnd,
        status,
        targetLabel: IsfUtils.formatMoney(target),
        actualLabel: IsfUtils.formatMoney(actual),
        remainingLabel: IsfUtils.formatMoney(Math.abs(remaining)),
        projectedMonthEndLabel: IsfUtils.formatMoney(projectedMonthEnd),
      };
    });
}

export function buildHouseholdBudgetSummary(inputs, now = new Date()) {
  const context = inputs?.householdContext || {};
  const baseIncome = getMonthlyIncomeTotalWon(inputs?.incomes);
  const spouseIncome = context.incomeMode === HOUSEHOLD_INCOME_MODES.dual
    ? safeMoney(context.spouseMonthlyIncome)
    : 0;
  const householdIncome = baseIncome + spouseIncome;
  const rows = buildVariableExpenseBudgetRows(inputs, now);
  const targetTotal = getMonthlyAllocationTotalWon(rows.map((row) => ({ amount: row.target })));
  const actualTotal = getMonthlyAllocationTotalWon(rows.map((row) => ({ amount: row.actual })));
  const projectedTotal = getMonthlyAllocationTotalWon(rows.map((row) => ({ amount: row.projectedMonthEnd })));
  const remaining = targetTotal - actualTotal;
  const status = resolveBudgetStatus({ target: targetTotal, actual: actualTotal, projected: projectedTotal });

  return {
    householdIncome,
    targetTotal,
    actualTotal,
    remaining,
    projectedMonthEnd: projectedTotal,
    status,
    projectionNote: HOUSEHOLD_PROJECTION_NOTE,
    metrics: [
      {
        id: "household-income",
        label: "가구 월수입",
        value: IsfUtils.formatMoney(householdIncome),
      },
      {
        id: "variable-actual-target",
        label: "변동비 실제/목표",
        value: `${IsfUtils.formatMoney(actualTotal)} / ${IsfUtils.formatMoney(targetTotal)}`,
      },
      {
        id: "variable-remaining",
        label: "남은 변동비",
        value: `${remaining < 0 ? "-" : ""}${IsfUtils.formatMoney(Math.abs(remaining))}`,
      },
    ],
    rows,
  };
}
