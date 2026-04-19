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
  { id: "rent", name: "주거비(월세)", amount: 60 },
  { id: "maintenance", name: "관리비", amount: 10 },
  { id: "telecom", name: "통신비", amount: 5 },
  { id: "transport", name: "교통비", amount: 10 },
  { id: "food", name: "식비", amount: 40 },
  { id: "etc", name: "기타생활비", amount: 20 },
];

export const DEFAULT_SAVINGS_ITEMS = [
  { id: "youth-saving", name: "청년적금", amount: 70, annualRate: 3.6 },
  { id: "housing-subscription", name: "주택청약", amount: 5, annualRate: 2.9 },
];

export const DEFAULT_INVEST_ITEMS = [
  { id: "global-stock", name: "해외주식", amount: 30 },
  { id: "isa", name: "ISA", amount: 30 },
  { id: "gold-spot", name: "금현물", amount: 3 },
];

export const DEFAULT_INPUTS = {
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

export const SAMPLE_INPUTS = {
  ...DEFAULT_INPUTS,
  incomes: [
    { id: "sample-income-1", name: "주급여", amount: 450 },
    { id: "sample-income-2", name: "부수입", amount: 50 },
  ],
  monthlyDebtPayment: 50,
  startCash: 500,
  startSavings: 2000,
  startInvest: 1000,
  startDebt: 1500,
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
