import {
  DEFAULT_INPUTS,
  DEFAULT_EXPENSE_ITEMS,
  DEFAULT_SAVINGS_ITEMS,
  DEFAULT_INVEST_ITEMS,
  MAX_INCOME_ITEMS,
  MAX_ALLOCATION_ITEMS,
} from "./constants.js";

export function cloneInputs(inputs) {
  if (typeof structuredClone === "function") {
    return structuredClone(inputs);
  }
  return JSON.parse(JSON.stringify(inputs));
}

const CURRENCY_KEYS = [
  "monthlyExpense", "monthlySavings", "monthlyInvest", "monthlyDebtPayment",
  "startCash", "startSavings", "startInvest", "startDebt",
  "monthlyIncome" // Computed field in some contexts
];

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
  const monthlyIncomeFallback = IsfUtils.sanitizeMoney(raw.monthlyIncome, getMonthlyIncomeTotalWon(DEFAULT_INPUTS.incomes));
  const monthlyExpenseFallback = IsfUtils.sanitizeMoney(raw.monthlyExpense, getMonthlyAllocationTotalWon(DEFAULT_EXPENSE_ITEMS));
  const monthlySavingsFallback = IsfUtils.sanitizeMoney(raw.monthlySavings, getMonthlyAllocationTotalWon(DEFAULT_SAVINGS_ITEMS));
  const monthlyInvestFallback = IsfUtils.sanitizeMoney(raw.monthlyInvest, getMonthlyAllocationTotalWon(DEFAULT_INVEST_ITEMS));
  const annualSavingsYield = IsfUtils.sanitizeRate(raw.annualSavingsYield, DEFAULT_INPUTS.annualSavingsYield, 20);
  const expenseItems = sanitizeExpenseItems(raw.expenseItems, monthlyExpenseFallback);
  const savingsItems = sanitizeSavingsItems(raw.savingsItems, monthlySavingsFallback, annualSavingsYield);
  const investItems = sanitizeInvestItems(raw.investItems, monthlyInvestFallback);

  return {
    incomes: sanitizeIncomeItems(raw.incomes, monthlyIncomeFallback),
    expenseItems,
    savingsItems,
    investItems,
    monthlyExpense: getMonthlyAllocationTotalWon(expenseItems),
    monthlySavings: getMonthlyAllocationTotalWon(savingsItems),
    monthlyInvest: getMonthlyAllocationTotalWon(investItems),
    monthlyDebtPayment: IsfUtils.sanitizeMoney(raw.monthlyDebtPayment, DEFAULT_INPUTS.monthlyDebtPayment),
    startCash: IsfUtils.sanitizeMoney(raw.startCash, DEFAULT_INPUTS.startCash),
    startSavings: IsfUtils.sanitizeMoney(raw.startSavings, DEFAULT_INPUTS.startSavings),
    startInvest: IsfUtils.sanitizeMoney(raw.startInvest, DEFAULT_INPUTS.startInvest),
    startDebt: IsfUtils.sanitizeMoney(raw.startDebt, DEFAULT_INPUTS.startDebt),
    annualIncomeGrowth: IsfUtils.sanitizeRate(raw.annualIncomeGrowth, DEFAULT_INPUTS.annualIncomeGrowth, 30),
    annualExpenseGrowth: IsfUtils.sanitizeRate(raw.annualExpenseGrowth, DEFAULT_INPUTS.annualExpenseGrowth, 30),
    annualSavingsYield,
    annualInvestReturn: IsfUtils.sanitizeRate(raw.annualInvestReturn, DEFAULT_INPUTS.annualInvestReturn, 30),
    annualDebtInterest: IsfUtils.sanitizeRate(raw.annualDebtInterest, DEFAULT_INPUTS.annualDebtInterest, 30),
    horizonYears: sanitizeInteger(raw.horizonYears, DEFAULT_INPUTS.horizonYears, 1, 40),
  };
}

export function sanitizeIncomeItems(items, fallbackAmount) {
  if (!Array.isArray(items) || items.length === 0) {
    return [createIncomeItem({ name: "급여", amount: fallbackAmount })];
  }

  const sanitized = items
    .map((item, index) => {
      const safeItem = item && typeof item === "object" ? item : {};
      const safeName = normalizeIncomeName(safeItem.name, index);
      const safeAmount = IsfUtils.sanitizeMoney(safeItem.amount, 0);
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

export function createIncomeItem({ id, name, amount } = {}) {
  return {
    id: typeof id === "string" && id.trim() ? id.trim() : createIncomeId(),
    name: normalizeIncomeName(name, 0),
    amount: IsfUtils.sanitizeMoney(amount, 0),
  };
}

export function getMonthlyIncomeTotalWon(incomes) {
  if (!Array.isArray(incomes)) {
    return 0;
  }
  return incomes.reduce((sum, income) => sum + IsfUtils.sanitizeMoney(income?.amount, 0), 0);
}

export function sanitizeExpenseItems(items, fallbackAmount) {
  return sanitizeAllocationItems(items, DEFAULT_EXPENSE_ITEMS, fallbackAmount, "expense", "생활비");
}

export function sanitizeSavingsAnnualRate(value, fallbackRate = DEFAULT_INPUTS.annualSavingsYield) {
  const safeFallback = IsfUtils.sanitizeRate(fallbackRate, DEFAULT_INPUTS.annualSavingsYield, 20);
  return IsfUtils.sanitizeRate(value, safeFallback, 20);
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

      const normalizedItem = {
        id: safeId,
        name: normalizeAllocationName(item.name, label, index),
        amount: IsfUtils.sanitizeMoney(item.amount, 0),
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
  return text.slice(0, 16);
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
  const safeTotal = IsfUtils.sanitizeMoney(totalAmount, getMonthlyAllocationTotalWon(defaultItems));
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
      amount: IsfUtils.sanitizeMoney(safeItem.amount * factor, 0),
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
  return items.reduce((sum, item) => sum + IsfUtils.sanitizeMoney(item?.amount, 0), 0);
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
