export const MONEY_UNIT = 10000;
export const STORAGE_KEY = "isf-rebuild-v1";
export const SHARE_STATE_KEY = "my-household-flow";
export const SHARE_STATE_SCHEMA = 1;
export const HASH_STATE_PARAM = "s";
export const SHARE_DB_NAME = "isf-share-pointer-db-v1";
export const SHARE_DB_VERSION = 1;
export const SHARE_DB_STORE = "shareSnapshots";
export const VIEW_MODE_GUIDE_DISMISSED_KEY = "isf-view-guide-dismissed-v1";
export const MANUAL_BACKUP_WINDOW_MS = 60 * 1000;
export const MAX_INCOME_ITEMS = 12;
export const MAX_ALLOCATION_ITEMS = 20;

export const SANKEY_VALUE_MODES = {
  AMOUNT: "amount",
  PERCENT: "percent",
};

export const SANKEY_SORT_MODES = {
  GROUP: "group",
  AMOUNT_DESC: "amount-desc",
  AMOUNT_ASC: "amount-asc",
  NAME_ASC: "name-asc",
};

export const ITEM_SORT_MODES = {
  DEFAULT: "default",
  AMOUNT_ASC: "amount-asc",
  AMOUNT_DESC: "amount-desc",
  NAME_ASC: "name-asc",
  NAME_DESC: "name-desc",
};

export const SANKEY_ZOOM_MIN = 1;
export const SANKEY_ZOOM_MAX = 2.6;
export const SANKEY_ZOOM_STEP = 0.2;
export const SANKEY_MOBILE_BASE_ZOOM = 0.65;
export const SANKEY_MOBILE_HEIGHT_RATIO = 0.62;
export const SANKEY_MOBILE_WIDTH_SCALE = 1.38;
export const SANKEY_MOBILE_MIN_COLUMN_STEP = 126;
export const SANKEY_MOBILE_MIN_COLUMN_STEP_WITH_INFLOW = 110;
export const MOBILE_LAYOUT_QUERY = "(max-width: 760px)";

export const DEFAULT_EXPENSE_ITEMS = [
  { id: "rent", name: "주거비(월세)", amount: 600000 },
  { id: "maintenance", name: "관리비", amount: 100000 },
  { id: "telecom", name: "통신비", amount: 50000 },
  { id: "transport", name: "교통비", amount: 100000 },
  { id: "food", name: "식비", amount: 400000 },
  { id: "etc", name: "기타생활비", amount: 200000 },
];

export const DEFAULT_SAVINGS_ITEMS = [
  { id: "youth-saving", name: "청년적금", amount: 700000, annualRate: 3.6 },
  { id: "housing-subscription", name: "주택청약", amount: 50000, annualRate: 2.9 },
];

export const DEFAULT_INVEST_ITEMS = [
  { id: "global-stock", name: "해외주식", amount: 300000 },
  { id: "isa", name: "ISA", amount: 300000 },
  { id: "gold-spot", name: "금현물", amount: 30000 },
];

export const DEFAULT_INPUTS = {
  modelVersion: 10, // 10: Won units normalized
  incomes: [
    { id: "income-main", name: "급여", amount: 3000000 },
  ],
  expenseItems: DEFAULT_EXPENSE_ITEMS,
  savingsItems: DEFAULT_SAVINGS_ITEMS,
  investItems: DEFAULT_INVEST_ITEMS,
  monthlyExpense: 1450000,
  monthlySavings: 750000,
  monthlyInvest: 630000,
  monthlyDebtPayment: 0,
  startCash: 1000000,
  startSavings: 30000000,
  startInvest: 30000000,
  startDebt: 0,
  annualIncomeGrowth: 4.0,
  annualExpenseGrowth: 2.5,
  annualSavingsYield: 3.0,
  annualInvestReturn: 9.5,
  annualDebtInterest: 4.2,
  horizonYears: 10,
};

export const SAMPLE_INPUTS = {
  ...DEFAULT_INPUTS,
  incomes: [
    { id: "sample-income-1", name: "주급여", amount: 4500000 },
    { id: "sample-income-2", name: "부수입", amount: 500000 },
  ],
  monthlyDebtPayment: 500000,
  startCash: 5000000,
  startSavings: 20000000,
  startInvest: 10000000,
  startDebt: 15000000,
};

export const TONE_COLORS = {
  income: "#1e8b7c",
  expense: "#c9573c",
  savings: "#3175b6",
  invest: "#5d4fb3",
  debt: "#8c3d65",
  surplus: "#2f9e44",
  deficit: "#d6336c",
};

export const FORM_FIELD_KEYS = [
  "monthlyExpense",
  "monthlySavings",
  "monthlyInvest",
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
