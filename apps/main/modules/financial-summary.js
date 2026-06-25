import { IsfUtils } from "../../../shared/core/utils.js";

import {
  getMonthlyAllocationTotalWon,
  getMonthlyIncomeTotalWon,
  isVariableExpenseItem,
} from "./input-sanitizer.js";

const CATEGORY_META = {
  income: { label: "수입", tone: "income", itemKey: "incomes" },
  account: { label: "계좌", tone: "account", itemKey: "accounts" },
  expense: { label: "지출", tone: "expense", itemKey: "expenseItems" },
  savings: { label: "저축", tone: "savings", itemKey: "savingsItems" },
  invest: { label: "투자", tone: "invest", itemKey: "investItems" },
};

const SUMMARY_GROUPS = [
  { id: "core-metrics", title: "핵심지표", categories: [] },
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

function buildExpenseGroupRepresentatives(items, limit = 3) {
  const totals = new Map([
    ["고정비", 0],
    ["변동비", 0],
  ]);
  safeItems(items).forEach((item) => {
    const group = isVariableExpenseItem(item) ? "변동비" : "고정비";
    totals.set(group, (totals.get(group) || 0) + (Number(item?.amount) || 0));
  });

  const preferredOrder = ["고정비", "변동비"];
  return Array.from(totals, ([group, amount]) => ({ group, amount }))
    .filter(({ amount }) => amount > 0)
    .sort((left, right) => {
      const leftOrder = preferredOrder.includes(left.group) ? preferredOrder.indexOf(left.group) : preferredOrder.length;
      const rightOrder = preferredOrder.includes(right.group) ? preferredOrder.indexOf(right.group) : preferredOrder.length;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return right.amount - left.amount;
    })
    .slice(0, limit)
    .map(({ group, amount }) => {
      const amountLabel = formatRepresentativeAmount(amount);
      return amountLabel ? `${group} ${amountLabel}` : group;
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
    : category === "expense"
      ? buildExpenseGroupRepresentatives(items)
      : buildItemRepresentatives(items);
  const correctionCount = countCorrections(inputs, category);

  return {
    type: "category",
    category,
    label: meta.label,
    tone: meta.tone,
    total,
    count: items.length,
    representatives,
    correctionCount,
  };
}

function formatSignedMoneyDelta(amount) {
  const numericAmount = Number(amount) || 0;
  if (numericAmount === 0) return "변화 0원";
  const prefix = numericAmount > 0 ? "+" : "-";
  return `변화 ${prefix}${IsfUtils.formatMoney(Math.abs(numericAmount))}`;
}

function formatFutureAssetRate(inputs) {
  const income = getMonthlyIncomeTotalWon(inputs.incomes);
  const futureAllocation = getMonthlyAllocationTotalWon(inputs.savingsItems) +
    getMonthlyAllocationTotalWon(inputs.investItems);
  const rate = income > 0 ? (futureAllocation / income) * 100 : 0;
  const cleanRate = Number.isFinite(rate) ? Math.round(rate * 10) / 10 : 0;
  return {
    value: `${cleanRate.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`,
    sub: `월 저축+투자 ${IsfUtils.formatMoney(futureAllocation)}`,
  };
}

function buildCoreMetricCards(inputs, projection) {
  const safeProjection = Array.isArray(projection) ? projection : [];
  const current = safeProjection[0] || null;
  const last = safeProjection[safeProjection.length - 1] || current;
  const horizonYears = Math.max(1, Math.round(Number(inputs.horizonYears) || 1));
  const netAsset = Number(last?.netAsset || 0);
  const deltaNet = current && last ? netAsset - Number(current.netAsset || 0) : 0;
  const futureRate = formatFutureAssetRate(inputs);

  return [
    {
      type: "metric",
      metric: "future-net-asset",
      label: `${horizonYears}년 후 순자산`,
      tone: netAsset >= 0 ? "income" : "deficit",
      total: netAsset,
      value: IsfUtils.formatMoney(netAsset),
      representatives: [formatSignedMoneyDelta(deltaNet)],
    },
    {
      type: "metric",
      metric: "future-asset-rate",
      label: "미래자산 투입률",
      tone: "invest",
      value: futureRate.value,
      representatives: [futureRate.sub],
    },
  ];
}

export function buildFinancialSummaryGroups(inputs, options = {}) {
  const safeInputs = inputs && typeof inputs === "object" ? inputs : {};
  return SUMMARY_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    cards: group.id === "core-metrics"
      ? buildCoreMetricCards(safeInputs, options.projection)
      : group.categories
        .map((category) => buildCard(safeInputs, category))
        .filter(Boolean),
  }));
}
