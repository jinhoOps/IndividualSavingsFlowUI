import {
  DEFAULT_INPUTS,
  DEFAULT_EXPENSE_ITEMS,
  DEFAULT_SAVINGS_ITEMS,
  DEFAULT_INVEST_ITEMS,
  MAX_INCOME_ITEMS,
  MAX_ALLOCATION_ITEMS,
  MAGIC_MAPPING_DEFAULTS,
} from "./constants.js";
import { repairAccountConnections, SIMPLE_ACCOUNT_ALIASES } from "./account-correction.js";

export function cloneInputs(inputs) {
  if (typeof structuredClone === "function") {
    return structuredClone(inputs);
  }
  return JSON.parse(JSON.stringify(inputs));
}

const CURRENCY_KEYS = [
  "monthlyExpense", "monthlySavings", "monthlyInvest", "monthlyDebtPayment",
  "startCash", "startSavings", "startInvest", "startDebt",
  "monthlyIncome"
];

const HOUSEHOLD_INCOME_MODE_SINGLE = "single-income";
const HOUSEHOLD_INCOME_MODE_DUAL = "dual-income";

export function migrateInputsToWon(raw) {
  if (raw.modelVersion && raw.modelVersion >= 10) return raw;
  
  const migrated = { ...raw, modelVersion: 10 };
  
  CURRENCY_KEYS.forEach(key => {
    if (typeof migrated[key] === "number") {
        migrated[key] *= 10000;
    }
  });

  const migrateItemArr = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.map(item => ({
      ...item,
      amount: (typeof item.amount === "number") ? item.amount * 10000 : item.amount
    }));
  };

  migrated.incomes = migrateItemArr(migrated.incomes);
  migrated.expenseItems = migrateItemArr(migrated.expenseItems);
  migrated.savingsItems = migrateItemArr(migrated.savingsItems);
  migrated.investItems = migrateItemArr(migrated.investItems);

  return migrated;
}

export function sanitizeInputs(rawInputs) {
  const raw = migrateInputsToWon(rawInputs);
  const monthlyIncomeFallback = window.IsfUtils.sanitizeMoney(raw.monthlyIncome, getMonthlyIncomeTotalWon(DEFAULT_INPUTS.incomes));
  const monthlyExpenseFallback = window.IsfUtils.sanitizeMoney(raw.monthlyExpense, getMonthlyAllocationTotalWon(DEFAULT_EXPENSE_ITEMS));
  const monthlySavingsFallback = window.IsfUtils.sanitizeMoney(raw.monthlySavings, getMonthlyAllocationTotalWon(DEFAULT_SAVINGS_ITEMS));
  const monthlyInvestFallback = window.IsfUtils.sanitizeMoney(raw.monthlyInvest, getMonthlyAllocationTotalWon(DEFAULT_INVEST_ITEMS));
  const annualSavingsYield = window.IsfUtils.sanitizeRate(raw.annualSavingsYield, DEFAULT_INPUTS.annualSavingsYield, 20);
  const expenseItems = sanitizeExpenseItems(raw.expenseItems, monthlyExpenseFallback);
  const savingsItems = sanitizeSavingsItems(raw.savingsItems, monthlySavingsFallback, annualSavingsYield);
  const investItems = sanitizeInvestItems(raw.investItems, monthlyInvestFallback);

  let sanitizedAccounts = [];
  if (!Array.isArray(raw.accounts) || raw.accounts.length === 0) {
    sanitizedAccounts = SIMPLE_ACCOUNT_ALIASES.map((account) => ({ ...account }));
  } else {
    sanitizedAccounts = raw.accounts.map((acc, index) => {
      const safeAcc = acc && typeof acc === "object" ? acc : {};
      const id = typeof safeAcc.id === "string" && safeAcc.id.trim()
        ? safeAcc.id.trim()
        : `acc-${Date.now()}-${index}`;
      const name = typeof safeAcc.name === "string" && safeAcc.name.trim()
        ? safeAcc.name.trim()
        : `계좌 ${index + 1}`;
      return { id, name };
    });
  }

  let surplusId = typeof raw.surplusTransferAccountId === "string" && raw.surplusTransferAccountId.trim()
    ? raw.surplusTransferAccountId.trim()
    : "";
  if (!sanitizedAccounts.some(acc => acc.id === surplusId)) {
    if (sanitizedAccounts.some(acc => acc.id === "acc-stock")) {
      surplusId = "acc-stock";
    } else if (sanitizedAccounts.length > 0) {
      surplusId = sanitizedAccounts[0].id;
    } else {
      surplusId = "acc-stock";
    }
  }

  const sanitized = {
    modelVersion: 10,
    incomes: sanitizeIncomeItems(raw.incomes, monthlyIncomeFallback),
    accounts: sanitizedAccounts,
    splitIncomeAccounts: Boolean(raw.splitIncomeAccounts),
    surplusTransferAccountId: surplusId,
    transfers: sanitizeTransfers(raw.transfers, sanitizedAccounts),
    householdContext: sanitizeHouseholdContext(raw.householdContext),
    expenseItems,
    savingsItems,
    investItems,
    monthlyExpense: getMonthlyAllocationTotalWon(expenseItems),
    monthlySavings: getMonthlyAllocationTotalWon(savingsItems),
    monthlyInvest: getMonthlyAllocationTotalWon(investItems),
    monthlyDebtPayment: window.IsfUtils.sanitizeMoney(raw.monthlyDebtPayment, DEFAULT_INPUTS.monthlyDebtPayment, 0),
    startCash: window.IsfUtils.sanitizeMoney(raw.startCash, DEFAULT_INPUTS.startCash, -1000000000000000),
    startSavings: window.IsfUtils.sanitizeMoney(raw.startSavings, DEFAULT_INPUTS.startSavings, 0),
    startInvest: window.IsfUtils.sanitizeMoney(raw.startInvest, DEFAULT_INPUTS.startInvest, 0),
    startDebt: window.IsfUtils.sanitizeMoney(raw.startDebt, DEFAULT_INPUTS.startDebt, 0),
    annualIncomeGrowth: window.IsfUtils.sanitizeRate(raw.annualIncomeGrowth, DEFAULT_INPUTS.annualIncomeGrowth, 30),
    annualExpenseGrowth: window.IsfUtils.sanitizeRate(raw.annualExpenseGrowth, DEFAULT_INPUTS.annualExpenseGrowth, 30),
    annualSavingsYield,
    annualInvestReturn: window.IsfUtils.sanitizeRate(raw.annualInvestReturn, DEFAULT_INPUTS.annualInvestReturn, 30),
    annualDebtInterest: window.IsfUtils.sanitizeRate(raw.annualDebtInterest, DEFAULT_INPUTS.annualDebtInterest, 30),
    horizonYears: sanitizeInteger(raw.horizonYears, DEFAULT_INPUTS.horizonYears, 1, 40),
  };

  const repaired = repairAccountConnections(sanitized);
  return {
    ...repaired,
    monthlyExpense: getMonthlyAllocationTotalWon(repaired.expenseItems),
    monthlySavings: getMonthlyAllocationTotalWon(repaired.savingsItems),
    monthlyInvest: getMonthlyAllocationTotalWon(repaired.investItems),
  };
}

export function sanitizeHouseholdContext(rawContext) {
  const safeContext = rawContext && typeof rawContext === "object" ? rawContext : {};
  const incomeMode = safeContext.incomeMode === HOUSEHOLD_INCOME_MODE_DUAL
    ? HOUSEHOLD_INCOME_MODE_DUAL
    : HOUSEHOLD_INCOME_MODE_SINGLE;

  return {
    profile: "newlywed",
    incomeMode,
    spouseMonthlyIncome: window.IsfUtils.sanitizeMoney(safeContext.spouseMonthlyIncome, 0, 0),
  };
}

export function isVariableExpenseItem(item) {
  const group = normalizeAllocationGroupName(item?.group);
  return group === "변동비";
}

export function sanitizeIncomeItems(items, fallbackAmount) {
  if (!Array.isArray(items) || items.length === 0) {
    return [createIncomeItem({ name: "급여", amount: fallbackAmount, accountId: MAGIC_MAPPING_DEFAULTS.income })];
  }

  const sanitized = items
    .map((item, index) => {
      const safeItem = item && typeof item === "object" ? item : {};
      const safeName = normalizeIncomeName(safeItem.name, index);
      const safeAmount = window.IsfUtils.sanitizeMoney(safeItem.amount, 0);
      const safeId = typeof safeItem.id === "string" && safeItem.id.trim()
        ? safeItem.id.trim()
        : createIncomeId();
      const safeAccountId = typeof safeItem.accountId === "string" && safeItem.accountId.trim()
        ? safeItem.accountId.trim()
        : (MAGIC_MAPPING_DEFAULTS?.income || "acc-salary");
      
      const rawAllocs = Array.isArray(safeItem.allocations) ? safeItem.allocations : [];
      const safeAllocations = rawAllocs.map(al => {
        const safeAl = al && typeof al === "object" ? al : {};
        return {
          accountId: typeof safeAl.accountId === "string" && safeAl.accountId.trim()
            ? safeAl.accountId.trim()
            : safeAccountId,
          amount: window.IsfUtils.sanitizeMoney(safeAl.amount, 0)
        };
      });

      if (safeAllocations.length === 0) {
        safeAllocations.push({ accountId: safeAccountId, amount: safeAmount });
      }

      return {
        id: safeId,
        name: safeName,
        amount: safeAmount,
        accountId: safeAccountId,
        allocations: safeAllocations
      };
    })
    .filter((item) => item.name || item.amount > 0)
    .slice(0, MAX_INCOME_ITEMS);

  if (sanitized.length > 0) {
    return sanitized;
  }

  return [createIncomeItem({ name: "급여", amount: fallbackAmount, accountId: MAGIC_MAPPING_DEFAULTS.income })];
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

export function createIncomeItem({ id, name, amount, accountId, allocations } = {}) {
  const safeAmount = window.IsfUtils.sanitizeMoney(amount, 0);
  const defaultAccountId = typeof accountId === "string" && accountId.trim() ? accountId.trim() : (MAGIC_MAPPING_DEFAULTS?.income || "acc-salary");
  
  const rawAllocs = Array.isArray(allocations) ? allocations : [];
  const safeAllocations = rawAllocs.map(al => {
    const safeAl = al && typeof al === "object" ? al : {};
    return {
      accountId: typeof safeAl.accountId === "string" && safeAl.accountId.trim() ? safeAl.accountId.trim() : defaultAccountId,
      amount: window.IsfUtils.sanitizeMoney(safeAl.amount, 0)
    };
  });

  if (safeAllocations.length === 0) {
    safeAllocations.push({ accountId: defaultAccountId, amount: safeAmount });
  }

  return {
    id: typeof id === "string" && id.trim() ? id.trim() : createIncomeId(),
    name: normalizeIncomeName(name, 0),
    amount: safeAmount,
    accountId: defaultAccountId,
    allocations: safeAllocations
  };
}

export function getMonthlyIncomeTotalWon(incomes) {
  if (!Array.isArray(incomes)) {
    return 0;
  }
  return incomes.reduce((sum, income) => sum + window.IsfUtils.sanitizeMoney(income?.amount, 0), 0);
}

export function sanitizeExpenseItems(items, fallbackAmount) {
  const actualSpentById = new Map();
  const varianceAmountById = new Map();
  if (Array.isArray(items)) {
    items.forEach((rawItem) => {
      const safeItem = rawItem && typeof rawItem === "object" ? rawItem : null;
      if (!safeItem || !isVariableExpenseItem(safeItem)) {
        return;
      }
      const itemId = typeof safeItem.id === "string" ? safeItem.id.trim() : "";
      if (!itemId) {
        return;
      }
      actualSpentById.set(itemId, window.IsfUtils.sanitizeMoney(safeItem.actualSpent, 0, 0));
      varianceAmountById.set(itemId, window.IsfUtils.sanitizeMoney(safeItem.varianceAmount, 0, 0));
    });
  }

  return sanitizeAllocationItems(items, DEFAULT_EXPENSE_ITEMS, fallbackAmount, "expense", "생활비")
    .map((item) => {
      if (!isVariableExpenseItem(item)) {
        const { actualSpent: _actualSpent, varianceAmount: _varianceAmount, ...rest } = item;
        return rest;
      }
      const nextItem = { ...item };
      if (actualSpentById.has(item.id)) nextItem.actualSpent = actualSpentById.get(item.id);
      if (varianceAmountById.has(item.id)) nextItem.varianceAmount = varianceAmountById.get(item.id);
      return nextItem;
    });
}

export function sanitizeSavingsAnnualRate(value, fallbackRate = DEFAULT_INPUTS.annualSavingsYield) {
  const safeFallback = window.IsfUtils.sanitizeRate(fallbackRate, DEFAULT_INPUTS.annualSavingsYield, 20);
  return window.IsfUtils.sanitizeRate(value, safeFallback, 20);
}

export function parseSavingsAnnualRateInput(value, fallbackRate = DEFAULT_INPUTS.annualSavingsYield) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  return sanitizeSavingsAnnualRate(text, fallbackRate);
}

export function sanitizeSavingsItems(items, fallbackAmount, fallbackRate = DEFAULT_INPUTS.annualSavingsYield) {
  const safeFallbackRate = sanitizeSavingsAnnualRate(fallbackRate, DEFAULT_INPUTS.annualSavingsYield);
  const normalized = sanitizeAllocationItems(
    items,
    DEFAULT_SAVINGS_ITEMS,
    fallbackAmount,
    "savings",
    "저축",
    { allowMaturity: true },
  );
  const rateById = new Map();

  if (Array.isArray(items)) {
    items.forEach((rawItem) => {
      const safeItem = rawItem && typeof rawItem === "object" ? rawItem : null;
      if (!safeItem) {
        return;
      }
      const itemId = typeof safeItem.id === "string" ? safeItem.id.trim() : "";
      if (!itemId || rateById.has(itemId)) {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(safeItem, "annualRate")) {
        return;
      }
      rateById.set(itemId, parseSavingsAnnualRateInput(safeItem.annualRate, safeFallbackRate));
    });
  }

  return normalized.map((item) => {
    const parsedRate = rateById.has(item.id)
      ? rateById.get(item.id)
      : parseSavingsAnnualRateInput(item?.annualRate, safeFallbackRate);

    if (parsedRate === null) {
      const { annualRate: _annualRate, ...rest } = item;
      return rest;
    }

    return {
      ...item,
      annualRate: parsedRate,
    };
  });
}

export function sanitizeInvestItems(items, fallbackAmount) {
  return sanitizeAllocationItems(
    items,
    DEFAULT_INVEST_ITEMS,
    fallbackAmount,
    "invest",
    "투자",
    { allowMaturity: true },
  );
}

export function sanitizeAllocationItems(
  items,
  defaultItems,
  fallbackAmount,
  prefix = "allocation",
  label = "항목",
  options = {},
) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const allowMaturity = Boolean(safeOptions.allowMaturity);
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

      const fallbackAccountId = (MAGIC_MAPPING_DEFAULTS && MAGIC_MAPPING_DEFAULTS[prefix]) || (MAGIC_MAPPING_DEFAULTS && MAGIC_MAPPING_DEFAULTS.expense) || "acc-living";
      const safeAccountId = typeof item.accountId === "string" && item.accountId.trim()
        ? item.accountId.trim()
        : fallbackAccountId;

      const normalizedItem = {
        id: safeId,
        name: normalizeAllocationName(item.name, label, index),
        amount: window.IsfUtils.sanitizeMoney(item.amount, 0),
        accountId: safeAccountId,
      };
      const normalizedGroup = normalizeAllocationGroupName(item.group);
      if (normalizedGroup) {
        normalizedItem.group = normalizedGroup;
      }
      if (Object.prototype.hasOwnProperty.call(item, "annualRate")) {
        normalizedItem.annualRate = item.annualRate;
      }
      if (allowMaturity) {
        const normalizedMaturityMonth = normalizeMaturityMonth(item.maturityMonth);
        if (normalizedMaturityMonth) {
          normalizedItem.maturityMonth = normalizedMaturityMonth;
        }
      }
      return normalizedItem;
    })
    .filter((item) => item.name || item.amount > 0)
    .slice(0, MAX_ALLOCATION_ITEMS);

  if (sanitized.length > 0) {
    return sanitized;
  }

  return scaleDefaultAllocationItemsToTotal(defaultItems, fallbackAmount);
}

export function createAllocationItemId(prefix, index = 0) {
  return `${prefix}-${Date.now()}-${index}-${Math.floor(Math.random() * 100000)}`;
}

export function normalizeAllocationName(name, label, index) {
  const text = String(name ?? "").trim();
  if (!text) {
    return `${label} ${index + 1}`;
  }
  return text.slice(0, 24);
}

export function normalizeAllocationGroupName(groupName) {
  const text = String(groupName ?? "").trim();
  if (!text) {
    return "";
  }
  const pathSegments = text.split("-").map((segment) => segment.trim()).filter(Boolean);
  const normalized = pathSegments[pathSegments.length - 1] || text;
  return normalized.slice(0, 16);
}

export function normalizeMaturityMonth(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return "";
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return "";
  }
  if (year < 2000 || year > 2200) {
    return "";
  }
  if (month < 1 || month > 12) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function getMaturityMonthIndex(maturityMonth, startDate = new Date()) {
  const normalized = normalizeMaturityMonth(maturityMonth);
  if (!normalized) {
    return null;
  }
  const [yearText, monthText] = normalized.split("-");
  const targetYear = Number(yearText);
  const targetMonth = Number(monthText) - 1;
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const monthGap = (targetYear - startYear) * 12 + (targetMonth - startMonth) + 1;
  if (!Number.isFinite(monthGap) || monthGap <= 0) {
    return 0;
  }
  return monthGap;
}

export function formatMaturityMonthLabel(maturityMonth) {
  const normalized = normalizeMaturityMonth(maturityMonth);
  return normalized ? `${normalized} 만기` : "";
}

export function buildAllocationMetaText(item, options = {}) {
  const safeOptions = options && typeof options === "object" ? options : {};
  const parts = [];
  const groupName = normalizeAllocationGroupName(item?.group);
  if (groupName) {
    parts.push(`그룹 ${groupName}`);
  }
  if (safeOptions.showMaturity) {
    const maturityLabel = formatMaturityMonthLabel(item?.maturityMonth);
    if (maturityLabel) {
      parts.push(maturityLabel);
    }
  }
  return parts.join(" · ");
}

export function scaleDefaultAllocationItemsToTotal(defaultItems, totalAmount) {
  const safeTotal = window.IsfUtils.sanitizeMoney(totalAmount, getMonthlyAllocationTotalWon(defaultItems));
  const baseTotal = getMonthlyAllocationTotalWon(defaultItems);

  if (baseTotal <= 0) {
    return defaultItems.map((item) => ({ ...item, amount: 0 }));
  }

  const factor = safeTotal / baseTotal;
  const scaled = defaultItems.map((item) => {
    const safeItem = item && typeof item === "object" ? item : {};
    return {
      ...safeItem,
      id: safeItem.id,
      name: safeItem.name,
      amount: window.IsfUtils.sanitizeMoney(safeItem.amount * factor, 0),
      accountId: safeItem.accountId,
    };
  });

  const currentTotal = getMonthlyAllocationTotalWon(scaled);
  const diff = safeTotal - currentTotal;
  const targetIndex = scaled.length - 1;
  scaled[targetIndex].amount = Math.max(0, scaled[targetIndex].amount + diff);

  return scaled;
}

export function getMonthlyAllocationTotalWon(items) {
  if (!Array.isArray(items)) {
    return 0;
  }
  return items.reduce((sum, item) => sum + window.IsfUtils.sanitizeMoney(item?.amount, 0), 0);
}

export function sanitizeInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(number)));
}

export function toMonthlyFactor(annualPercent) {
  const annualRate = Number(annualPercent) / 100;
  return Math.pow(1 + annualRate, 1 / 12);
}
 
export function sanitizeTransfers(transfers, accounts) {
  if (!Array.isArray(transfers)) return [];
  const accountIds = new Set(accounts.map(a => a.id));
  return transfers
    .map((tr, index) => {
      const safeTr = tr && typeof tr === "object" ? tr : {};
      const id = typeof safeTr.id === "string" && safeTr.id.trim() ? safeTr.id.trim() : `tr-${Date.now()}-${index}`;
      const sourceAccountId = typeof safeTr.sourceAccountId === "string" ? safeTr.sourceAccountId.trim() : "";
      const targetAccountId = typeof safeTr.targetAccountId === "string" ? safeTr.targetAccountId.trim() : "";
      const amount = window.IsfUtils.sanitizeMoney(safeTr.amount, 0);
      const label = typeof safeTr.label === "string" && safeTr.label.trim() ? safeTr.label.trim() : `이체 ${index + 1}`;
 
      if (sourceAccountId && targetAccountId && sourceAccountId !== targetAccountId && accountIds.has(sourceAccountId) && accountIds.has(targetAccountId)) {
        return { id, sourceAccountId, targetAccountId, amount, label };
      }
      return null;
    })
    .filter(Boolean);
}

