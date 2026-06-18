import { IsfUtils } from "../../../shared/core/utils.js";

import {
  getMonthlyAllocationTotalWon,
  getMonthlyIncomeTotalWon,
} from "./input-sanitizer.js";

const CATEGORY_META = {
  income: { label: "수입", tone: "income", itemKey: "incomes" },
  account: { label: "계좌", tone: "account", itemKey: "accounts" },
  expense: { label: "지출", tone: "expense", itemKey: "expenseItems" },
  savings: { label: "저축", tone: "savings", itemKey: "savingsItems" },
  invest: { label: "투자", tone: "invest", itemKey: "investItems" },
};

const SUMMARY_GROUPS = [
  { id: "income-account", title: "수입+계좌", categories: ["income", "account"] },
  { id: "outflow", title: "지출+저축+투자", categories: ["expense", "savings", "invest"] },
];

function safeItems(items) {
  return Array.isArray(items) ? items : [];
}

function getShortAccountName(name) {
  return String(name || "").replace(/(계좌|통장)$/, "");
}

function sumIncomeToAccount(inputs, accountId) {
  return safeItems(inputs.incomes).reduce((sum, income) => {
    const allocations = safeItems(income.allocations);
    if (allocations.length > 0) {
      return sum + allocations
        .filter((allocation) => allocation.accountId === accountId)
        .reduce((allocationSum, allocation) => allocationSum + (Number(allocation.amount) || 0), 0);
    }
    return income.accountId === accountId ? sum + (Number(income.amount) || 0) : sum;
  }, 0);
}

function formatRepresentativeAmount(amount) {
  const safeAmount = Number(amount) || 0;
  if (safeAmount <= 0) return "";
  return IsfUtils.formatMoney(safeAmount);
}

function buildItemRepresentatives(items, limit = 3) {
  return safeItems(items)
    .filter((item) => item && (item.name || item.id))
    .slice(0, limit)
    .map((item) => {
      const amountLabel = formatRepresentativeAmount(item.amount);
      return amountLabel ? `${item.name || item.id} ${amountLabel}` : `${item.name || item.id}`;
    });
}

function buildAccountRepresentatives(inputs, limit = 3) {
  return safeItems(inputs.accounts)
    .slice(0, limit)
    .map((account) => {
      const inflow = sumIncomeToAccount(inputs, account.id);
      const amountLabel = formatRepresentativeAmount(inflow);
      return amountLabel
        ? `${getShortAccountName(account.name)} 입금 ${amountLabel}`
        : getShortAccountName(account.name);
    });
}

function countCorrections(inputs, category) {
  const corrections = safeItems(inputs.accountCorrections);
  if (category === "account") return corrections.length;
  return corrections.filter((correction) => correction.itemType === category).length;
}

function buildCard(inputs, category) {
  const meta = CATEGORY_META[category];
  if (!meta) return null;

  const items = safeItems(inputs[meta.itemKey]);
  const total = category === "income"
    ? getMonthlyIncomeTotalWon(inputs.incomes)
    : category === "account"
      ? getMonthlyIncomeTotalWon(inputs.incomes)
      : getMonthlyAllocationTotalWon(items);
  const representatives = category === "account"
    ? buildAccountRepresentatives(inputs)
    : buildItemRepresentatives(items);
  const correctionCount = countCorrections(inputs, category);

  return {
    category,
    label: meta.label,
    tone: meta.tone,
    total,
    count: items.length,
    representatives,
    correctionCount,
    meta: correctionCount > 0 ? `${correctionCount}건 자동 보정` : "",
  };
}

export function buildFinancialSummaryGroups(inputs) {
  const safeInputs = inputs && typeof inputs === "object" ? inputs : {};
  return SUMMARY_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    cards: group.categories
      .map((category) => buildCard(safeInputs, category))
      .filter(Boolean),
  }));
}

