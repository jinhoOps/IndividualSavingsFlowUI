export const MONEY_UNIT = 10000;
export const MAGIC_MAPPING_DEFAULTS = {
  income: "acc-salary",
  expense: "acc-living",
  savings: "acc-salary",
  invest: "acc-stock"
};
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

export const PR_MODE_ASSUMED_ANNUAL_DIV_YIELD = 0.02; // 연 2% 수준의 배당 수익률 가정

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
  { id: "rent", name: "주거비(대출상환)", amount: 600000, group: "생활비-고정비-주거비", accountId: "acc-living" },
  { id: "maintenance", name: "관리비", amount: 100000, group: "생활비-고정비-공과금", accountId: "acc-living" },
  { id: "water", name: "수도세", amount: 20000, group: "생활비-고정비-공과금", accountId: "acc-living" },
  { id: "gas", name: "가스비", amount: 50000, group: "생활비-고정비-공과금", accountId: "acc-living" },
  { id: "electricity", name: "전기세", amount: 50000, group: "생활비-고정비-공과금", accountId: "acc-living" },
  { id: "telecom", name: "통신비", amount: 50000, group: "생활비-고정비-통신비", accountId: "acc-living" },
  { id: "insurance", name: "보험료", amount: 150000, group: "생활비-고정비-보험료", accountId: "acc-living" },
  { id: "transport", name: "교통비", amount: 100000, accountId: "acc-living" },
  { id: "food", name: "식비", amount: 400000, accountId: "acc-living" },
  { id: "etc", name: "기타생활비", amount: 200000, accountId: "acc-living" },
];

export const DEFAULT_SAVINGS_ITEMS = [
  { id: "youth-saving", name: "청년적금", amount: 700000, annualRate: 3.6, accountId: "acc-salary" },
  { id: "housing-subscription", name: "주택청약", amount: 50000, annualRate: 2.9, accountId: "acc-salary" },
];

export const DEFAULT_INVEST_ITEMS = [
  { id: "global-stock", name: "해외주식", amount: 300000, accountId: "acc-stock" },
  { id: "isa", name: "ISA", amount: 300000, accountId: "acc-stock" },
  { id: "gold-spot", name: "금현물", amount: 30000, accountId: "acc-stock" },
];

export const DEFAULT_INPUTS = {
  modelVersion: 10,
  incomes: [
    { 
      id: "income-main", 
      name: "급여", 
      amount: 3000000, 
      accountId: "acc-salary",
      allocations: [
        { accountId: "acc-salary", amount: 900000 },
        { accountId: "acc-living", amount: 1500000 },
        { accountId: "acc-stock", amount: 600000 }
      ]
    },
  ],
  accounts: [
    { id: "acc-salary", name: "급여계좌" },
    { id: "acc-living", name: "생활비계좌" },
    { id: "acc-stock", name: "주식계좌" }
  ],
  surplusTransferAccountId: "acc-stock",
  transfers: [],
  expenseItems: DEFAULT_EXPENSE_ITEMS,
  savingsItems: DEFAULT_SAVINGS_ITEMS,
  investItems: DEFAULT_INVEST_ITEMS,
  monthlyExpense: 1720000,
  monthlySavings: 750000,
  monthlyInvest: 630000,
  monthlyDebtPayment: 0,
  startCash: 5000000,
  startSavings: 10000000,
  startInvest: 5000000,
  startDebt: 5000000,
  annualIncomeGrowth: 4.0,
  annualExpenseGrowth: 2.5,
  annualSavingsYield: 3.0,
  annualInvestReturn: 9.5,
  annualDebtInterest: 5.2,
  horizonYears: 5,
};

export const SAMPLE_INPUTS = {
  ...DEFAULT_INPUTS,
  incomes: [
    { 
      id: "sample-income-1", 
      name: "주급여", 
      amount: 4500000, 
      accountId: "acc-salary",
      allocations: [
        { accountId: "acc-salary", amount: 1500000 },
        { accountId: "acc-living", amount: 2000000 },
        { accountId: "acc-stock", amount: 1000000 }
      ]
    },
    { 
      id: "sample-income-2", 
      name: "부수입", 
      amount: 300000, 
      accountId: "acc-salary",
      allocations: [
        { accountId: "acc-salary", amount: 300000 }
      ]
    },
  ],
  accounts: [
    { id: "acc-salary", name: "급여계좌" },
    { id: "acc-living", name: "생활비계좌" },
    { id: "acc-stock", name: "주식계좌" },
    { id: "acc-cma", name: "CMA비상금계좌" }
  ],
  transfers: [
    { id: "sample-tr-1", sourceAccountId: "acc-salary", targetAccountId: "acc-cma", amount: 300000 },
    { id: "sample-tr-2", sourceAccountId: "acc-salary", targetAccountId: "acc-stock", amount: 500000 },
    { id: "sample-tr-3", sourceAccountId: "acc-cma", targetAccountId: "acc-living", amount: 150000 }
  ],
  expenseItems: [
    { id: "rent", name: "주거비(대출상환)", amount: 800000, group: "생활비-고정비-주거비", accountId: "acc-living" },
    { id: "maintenance", name: "관리비", amount: 120000, group: "생활비-고정비-공과금", accountId: "acc-living" },
    { id: "water", name: "수도세", amount: 20000, group: "생활비-고정비-공과금", accountId: "acc-living" },
    { id: "gas", name: "가스비", amount: 60000, group: "생활비-고정비-공과금", accountId: "acc-living" },
    { id: "electricity", name: "전기세", amount: 50000, group: "생활비-고정비-공과금", accountId: "acc-living" },
    { id: "telecom", name: "통신비", amount: 60000, group: "생활비-고정비-통신비", accountId: "acc-living" },
    { id: "insurance", name: "보험료", amount: 200000, group: "생활비-고정비-보험료", accountId: "acc-living" },
    { id: "transport", name: "교통비", amount: 150000, accountId: "acc-living" },
    { id: "food", name: "식비", amount: 500000, accountId: "acc-living" },
    { id: "etc", name: "기타생활비", amount: 250000, accountId: "acc-living" },
  ],
  savingsItems: [
    { id: "youth-saving", name: "청년적금", amount: 700000, annualRate: 3.6, accountId: "acc-salary" },
    { id: "housing-subscription", name: "주택청약", amount: 200000, annualRate: 2.9, accountId: "acc-cma" },
  ],
  investItems: [
    { id: "global-stock", name: "해외주식", amount: 500000, accountId: "acc-stock" },
    { id: "isa", name: "ISA", amount: 400000, accountId: "acc-stock" },
    { id: "gold-spot", name: "금현물", amount: 100000, accountId: "acc-stock" },
  ],
  surplusTransferAccountId: "acc-stock",
  monthlyExpense: 2210000,
  monthlySavings: 900000,
  monthlyInvest: 1000000,
  monthlyDebtPayment: 400000,
  startCash: 15000000,
  startSavings: 150000000,
  startInvest: 750000000,
  startDebt: 50000000,
  annualSavingsYield: 3.5,
  annualInvestReturn: 9.5,
  annualDebtInterest: 5.2,
  horizonYears: 5,
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

