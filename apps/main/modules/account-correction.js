import { MAGIC_MAPPING_DEFAULTS } from "./constants.js";

export const SIMPLE_ACCOUNT_ALIASES = [
  { id: "acc-salary", name: "급여계좌" },
  { id: "acc-living", name: "생활비계좌" },
  { id: "acc-stock", name: "투자계좌" },
];

const CATEGORY_LABELS = {
  income: "수입",
  expense: "지출",
  savings: "저축",
  invest: "투자",
};

const ACCOUNT_NAME_HINTS = {
  income: ["급여", "월급", "수입"],
  expense: ["생활", "지출", "소비"],
  savings: ["급여", "저축", "적금", "예금"],
  invest: ["투자", "주식", "증권", "isa"],
};

function sanitizeAmount(value) {
  if (typeof window !== "undefined" && window.IsfUtils?.sanitizeMoney) {
    return window.IsfUtils.sanitizeMoney(value, 0);
  }
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function cloneRecord(record) {
  return record && typeof record === "object" ? { ...record } : {};
}

function getAccounts(inputs) {
  const accounts = Array.isArray(inputs?.accounts) ? inputs.accounts : [];
  return accounts.length > 0 ? accounts : SIMPLE_ACCOUNT_ALIASES;
}

function getAccountIds(inputs) {
  return new Set(getAccounts(inputs).map((account) => account.id));
}

function hasValidAccount(inputs, accountId) {
  return typeof accountId === "string" && getAccountIds(inputs).has(accountId.trim());
}

function findHintedAccount(inputs, category) {
  const hints = ACCOUNT_NAME_HINTS[category] || [];
  return getAccounts(inputs).find((account) => {
    const text = `${account?.id || ""} ${account?.name || ""}`.toLowerCase();
    return hints.some((hint) => text.includes(hint.toLowerCase()));
  });
}

export function recommendAccountId(inputs, category, item = {}) {
  const accounts = getAccounts(inputs);
  if (accounts.length === 0) {
    return "";
  }

  if (hasValidAccount(inputs, item.accountId)) {
    return item.accountId.trim();
  }

  const defaultId = MAGIC_MAPPING_DEFAULTS[category] || MAGIC_MAPPING_DEFAULTS.expense;
  if (hasValidAccount(inputs, defaultId)) {
    return defaultId;
  }

  const hinted = findHintedAccount(inputs, category);
  return hinted?.id || accounts[0].id;
}

function createCorrection({ item, itemType, originalAccountId, resolvedAccountId, amountDelta = 0, reason }) {
  const label = CATEGORY_LABELS[itemType] || "항목";
  const itemName = item?.name || item?.label || item?.id || label;
  return {
    itemId: item?.id || "",
    itemType,
    originalAccountId: originalAccountId || "",
    resolvedAccountId: resolvedAccountId || "",
    amountDelta,
    message: `${label} '${itemName}' 계좌 연결을 ${resolvedAccountId}로 보정했습니다.${reason ? ` ${reason}` : ""}`,
  };
}

function repairAllocationItems(inputs, items, itemType, corrections) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const repaired = cloneRecord(item);
    const originalAccountId = typeof repaired.accountId === "string" ? repaired.accountId.trim() : "";
    const resolvedAccountId = recommendAccountId(inputs, itemType, repaired);
    if (originalAccountId !== resolvedAccountId) {
      corrections.push(createCorrection({
        item: repaired,
        itemType,
        originalAccountId,
        resolvedAccountId,
      }));
    }
    repaired.accountId = resolvedAccountId;
    return repaired;
  });
}

function aggregateAllocations(allocations) {
  const aggregate = new Map();
  allocations.forEach((allocation) => {
    const amount = sanitizeAmount(allocation.amount);
    if (amount <= 0 || !allocation.accountId) {
      return;
    }
    aggregate.set(allocation.accountId, (aggregate.get(allocation.accountId) || 0) + amount);
  });
  return Array.from(aggregate, ([accountId, amount]) => ({ accountId, amount }));
}

function repairIncomeItem(inputs, income, corrections) {
  const repaired = cloneRecord(income);
  const resolvedAccountId = recommendAccountId(inputs, "income", repaired);
  const originalAccountId = typeof repaired.accountId === "string" ? repaired.accountId.trim() : "";
  const amount = sanitizeAmount(repaired.amount);
  const splitIncomeAccounts = Boolean(inputs?.splitIncomeAccounts);

  if (originalAccountId !== resolvedAccountId) {
    corrections.push(createCorrection({
      item: repaired,
      itemType: "income",
      originalAccountId,
      resolvedAccountId,
    }));
  }

  repaired.accountId = resolvedAccountId;

  if (!splitIncomeAccounts) {
    const originalAllocationTotal = (Array.isArray(repaired.allocations) ? repaired.allocations : [])
      .reduce((sum, allocation) => sum + sanitizeAmount(allocation?.amount), 0);
    if (
      originalAllocationTotal !== amount ||
      !Array.isArray(repaired.allocations) ||
      repaired.allocations.length !== 1 ||
      repaired.allocations[0]?.accountId !== resolvedAccountId
    ) {
      corrections.push(createCorrection({
        item: repaired,
        itemType: "income",
        originalAccountId: repaired.allocations?.[0]?.accountId || originalAccountId,
        resolvedAccountId,
        amountDelta: amount - originalAllocationTotal,
        reason: "수입은 단일 입금 계좌 allocation으로 맞췄습니다.",
      }));
    }
    repaired.allocations = [{ accountId: resolvedAccountId, amount }];
    return repaired;
  }

  const repairedAllocations = (Array.isArray(repaired.allocations) ? repaired.allocations : [])
    .map((allocation) => {
      const originalAllocationId = typeof allocation?.accountId === "string" ? allocation.accountId.trim() : "";
      const allocationAccountId = hasValidAccount(inputs, originalAllocationId)
        ? originalAllocationId
        : resolvedAccountId;
      if (originalAllocationId !== allocationAccountId) {
        corrections.push(createCorrection({
          item: repaired,
          itemType: "income",
          originalAccountId: originalAllocationId,
          resolvedAccountId: allocationAccountId,
        }));
      }
      return {
        accountId: allocationAccountId,
        amount: sanitizeAmount(allocation?.amount),
      };
    });

  const allocationTotal = repairedAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const delta = amount - allocationTotal;
  if (delta !== 0 || repairedAllocations.length === 0) {
    repairedAllocations.push({ accountId: resolvedAccountId, amount: delta });
    corrections.push(createCorrection({
      item: repaired,
      itemType: "income",
      originalAccountId: "",
      resolvedAccountId,
      amountDelta: delta,
      reason: "수입 allocation 합계를 항목 금액과 일치시켰습니다.",
    }));
  }

  repaired.allocations = aggregateAllocations(repairedAllocations)
    .filter((allocation) => allocation.amount > 0);
  if (repaired.allocations.length === 0 && amount > 0) {
    repaired.allocations = [{ accountId: resolvedAccountId, amount }];
  }
  return repaired;
}

export function repairAccountConnections(inputs) {
  const base = inputs && typeof inputs === "object" ? { ...inputs } : {};
  const corrections = [];
  const accounts = getAccounts(base).map((account) => ({ ...account }));
  const repairContext = { ...base, accounts };

  const repaired = {
    ...base,
    accounts,
    splitIncomeAccounts: Boolean(base.splitIncomeAccounts),
  };

  repaired.incomes = (Array.isArray(base.incomes) ? base.incomes : [])
    .map((income) => repairIncomeItem(repairContext, income, corrections));
  repaired.expenseItems = repairAllocationItems(repairContext, base.expenseItems, "expense", corrections);
  repaired.savingsItems = repairAllocationItems(repairContext, base.savingsItems, "savings", corrections);
  repaired.investItems = repairAllocationItems(repairContext, base.investItems, "invest", corrections);
  repaired.accountCorrections = corrections;

  return repaired;
}

export function summarizeAccountCorrections(corrections) {
  const safeCorrections = Array.isArray(corrections) ? corrections : [];
  if (safeCorrections.length === 0) {
    return "";
  }
  return safeCorrections.map((correction) => correction.message).join("\n");
}
