export const PRESET_SALARIES = [
  { label: '3,000만 원', value: 30000000, monthlyIncome: 2250000 },
  { label: '4,000만 원', value: 40000000, monthlyIncome: 2950000 },
  { label: '5,000만 원', value: 50000000, monthlyIncome: 3550000 },
  { label: '6,000만 원', value: 60000000, monthlyIncome: 4200000 },
  { label: '7,000만 원', value: 70000000, monthlyIncome: 4850000 },
  { label: '8,000만 원', value: 80000000, monthlyIncome: 5400000 },
  { label: '9,000만 원', value: 90000000, monthlyIncome: 6000000 },
  { label: '10,000만 원', value: 100000000, monthlyIncome: 6550000 }
];

export const PRESET_STYLES = {
  conservative: { expenseRate: 0.5, savingsRate: 0.4, investRate: 0.1 },
  neutral: { expenseRate: 0.5, savingsRate: 0.3, investRate: 0.2 },
  aggressive: { expenseRate: 0.4, savingsRate: 0.1, investRate: 0.5 },
  beast: { expenseRate: 0.3, savingsRate: 0.0, investRate: 0.7 }
};

const EXPENSE_DETAIL = [
  { id: "rent",        name: "주거비(대출상환)", weight: 0.30, group: "생활비-고정비-주거비" },
  { id: "maintenance", name: "관리비",       weight: 0.05, group: "생활비-고정비-공과금" },
  { id: "water",       name: "수도세",       weight: 0.02, group: "생활비-고정비-공과금" },
  { id: "gas",         name: "가스비",       weight: 0.03, group: "생활비-고정비-공과금" },
  { id: "electricity", name: "전기세",       weight: 0.03, group: "생활비-고정비-공과금" },
  { id: "telecom",     name: "통신비",       weight: 0.03, group: "생활비-고정비-통신비" },
  { id: "insurance",   name: "보험료",       weight: 0.08, group: "생활비-고정비-보험료" },
  { id: "transport",   name: "교통비",       weight: 0.08 },
  { id: "food",        name: "식비",         weight: 0.23 },
  { id: "etc",         name: "기타생활비",   weight: 0.15 },
];

const SAVINGS_DETAIL = [
  { id: "emergency",            name: "비상금",     weight: 0.30, annualRate: 2.0 },
  { id: "youth-saving",         name: "청년적금",   weight: 0.50, annualRate: 3.6 },
  { id: "housing-subscription", name: "주택청약",   weight: 0.20, annualRate: 2.9 },
];

const INVEST_DETAIL = [
  { id: "global-stock", name: "해외주식",     weight: 0.40 },
  { id: "isa",          name: "ISA",          weight: 0.35 },
  { id: "pension",      name: "개인연금/IRP", weight: 0.25 },
];

function getStartingCapitalMultipliers(styleKey) {
  if (styleKey === "aggressive" || styleKey === "beast") {
    return { cash: 0.02, savings: 0.2, invest: 0.8, debt: 0.5 };
  }
  return { cash: 0.02, savings: 0.8, invest: 0.2, debt: 0.5 };
}

function distributeAmount(total, details) {
  const items = details.map(d => ({
    ...d,
    amount: Math.round(total * d.weight),
  }));
  const sum = items.reduce((s, i) => s + i.amount, 0);
  items[0].amount += (total - sum);
  return items.map(({ weight, ...rest }) => rest);
}


export function applyPreset(salaryValue, styleKey) {
  const salary = PRESET_SALARIES.find(s => s.value === salaryValue);
  const style = PRESET_STYLES[styleKey];
  
  if (!salary || !style) return null;
  
  const income = salary.monthlyIncome;
  
  const expense = Math.round(income * style.expenseRate);
  const savings = Math.round(income * style.savingsRate);
  const invest = Math.round(income * style.investRate);

  const allocLiving = Math.round(income * style.expenseRate);
  const allocInvest = Math.round(income * style.investRate);
  const allocSalary = income - (allocLiving + allocInvest);

  const allocations = [];
  if (allocLiving > 0) allocations.push({ accountId: "acc-living", amount: allocLiving });
  if (allocSalary > 0) allocations.push({ accountId: "acc-salary", amount: allocSalary });
  if (allocInvest > 0) allocations.push({ accountId: "acc-stock", amount: allocInvest });

  const startingCapital = getStartingCapitalMultipliers(styleKey);
  const startCash = Math.round(salaryValue * startingCapital.cash);
  const startDebt = Math.round(salaryValue * startingCapital.debt);
  const startSavings = Math.round(salaryValue * startingCapital.savings);
  const startInvest = Math.round(salaryValue * startingCapital.invest);

  const transfers = [];
  if (income > 0) {
    transfers.push({ id: "preset-tr-1", sourceAccountId: "acc-salary", targetAccountId: "acc-cma", amount: Math.round(income * 0.08), label: "비상금 저축" });
    transfers.push({ id: "preset-tr-2", sourceAccountId: "acc-salary", targetAccountId: "acc-stock", amount: Math.round(income * 0.15), label: "투자금 이체" });
    transfers.push({ id: "preset-tr-3", sourceAccountId: "acc-cma", targetAccountId: "acc-living", amount: Math.round(income * 0.04), label: "생활비 보조" });
  }

  return {
    incomes: [{ id: "income-preset", name: "급여", amount: income, accountId: "acc-salary", allocations }],
    accounts: [
      { id: "acc-salary", name: "급여계좌" },
      { id: "acc-living", name: "생활비계좌" },
      { id: "acc-stock", name: "주식계좌" },
      { id: "acc-cma", name: "CMA비상금계좌" }
    ],
    transfers,
    monthlyExpense: expense,
    monthlySavings: savings,
    monthlyInvest: invest,
    expenseItems: distributeAmount(expense, EXPENSE_DETAIL.map(d => ({ ...d, accountId: "acc-living" }))),
    savingsItems: distributeAmount(savings, SAVINGS_DETAIL.map((d, idx) => ({ ...d, accountId: idx === 0 ? "acc-cma" : "acc-salary" }))),
    investItems: distributeAmount(invest, INVEST_DETAIL.map(d => ({ ...d, accountId: "acc-stock" }))),
    monthlyDebtPayment: 0,
    startCash,
    startSavings,
    startInvest,
    startDebt
  };
}

export function calculateMonthlyIncomeFromAnnualSalary(salaryWon) {
  const salaryMan = Number(salaryWon || 0) / 10000;
  const table = [
    { salary: 0, monthly: 0 },
    { salary: 3000, monthly: 2250000 },
    { salary: 4000, monthly: 2950000 },
    { salary: 5000, monthly: 3550000 },
    { salary: 6000, monthly: 4200000 },
    { salary: 7000, monthly: 4850000 },
    { salary: 8000, monthly: 5400000 },
    { salary: 9000, monthly: 6000000 },
    { salary: 10000, monthly: 6550000 }
  ];

  if (salaryMan <= 0) return 0;
  if (salaryMan >= 10000) {
    return Math.round(6550000 * (salaryMan / 10000));
  }

  for (let i = 0; i < table.length - 1; i++) {
    const p1 = table[i];
    const p2 = table[i + 1];
    if (salaryMan >= p1.salary && salaryMan <= p2.salary) {
      const ratio = (salaryMan - p1.salary) / (p2.salary - p1.salary);
      return Math.round(p1.monthly + ratio * (p2.monthly - p1.monthly));
    }
  }
  return 0;
}

export function calculateAnnualSalaryFromMonthlyIncome(monthlyWon) {
  const table = [
    { salary: 0, monthly: 0 },
    { salary: 3000, monthly: 2250000 },
    { salary: 4000, monthly: 2950000 },
    { salary: 5000, monthly: 3550000 },
    { salary: 6000, monthly: 4200000 },
    { salary: 7000, monthly: 4850000 },
    { salary: 8000, monthly: 5400000 },
    { salary: 9000, monthly: 6000000 },
    { salary: 10000, monthly: 6550000 }
  ];

  if (monthlyWon <= 0) return 0;
  if (monthlyWon >= 6550000) {
    return Math.round(100000000 * (monthlyWon / 6550000));
  }

  for (let i = 0; i < table.length - 1; i++) {
    const p1 = table[i];
    const p2 = table[i + 1];
    if (monthlyWon >= p1.monthly && monthlyWon <= p2.monthly) {
      const ratio = (monthlyWon - p1.monthly) / (p2.monthly - p1.monthly);
      const salaryMan = p1.salary + ratio * (p2.salary - p1.salary);
      return Math.round(salaryMan * 10000);
    }
  }
  return 0;
}

export function applyPresetBySalary(salaryWon, styleKey) {
  const style = PRESET_STYLES[styleKey];
  if (!style) return null;
  
  const validSalaryWon = Math.max(0, Math.min(99000000, Number(salaryWon) || 0));
  const income = calculateMonthlyIncomeFromAnnualSalary(validSalaryWon);
  
  const expense = Math.round(income * style.expenseRate);
  const savings = Math.round(income * style.savingsRate);
  const invest = Math.round(income * style.investRate);

  const allocLiving = Math.round(income * style.expenseRate);
  const allocInvest = Math.round(income * style.investRate);
  const allocSalary = income - (allocLiving + allocInvest);

  const allocations = [];
  if (allocLiving > 0) allocations.push({ accountId: "acc-living", amount: allocLiving });
  if (allocSalary > 0) allocations.push({ accountId: "acc-salary", amount: allocSalary });
  if (allocInvest > 0) allocations.push({ accountId: "acc-stock", amount: allocInvest });

  const startingCapital = getStartingCapitalMultipliers(styleKey);
  const startCash = Math.round(validSalaryWon * startingCapital.cash);
  const startDebt = Math.round(validSalaryWon * startingCapital.debt);
  const startSavings = Math.round(validSalaryWon * startingCapital.savings);
  const startInvest = Math.round(validSalaryWon * startingCapital.invest);

  const transfers = [];
  if (income > 0) {
    transfers.push({ id: "preset-tr-1", sourceAccountId: "acc-salary", targetAccountId: "acc-cma", amount: Math.round(income * 0.08), label: "비상금 저축" });
    transfers.push({ id: "preset-tr-2", sourceAccountId: "acc-salary", targetAccountId: "acc-stock", amount: Math.round(income * 0.15), label: "투자금 이체" });
    transfers.push({ id: "preset-tr-3", sourceAccountId: "acc-cma", targetAccountId: "acc-living", amount: Math.round(income * 0.04), label: "생활비 보조" });
  }

  return {
    incomes: [{ id: "income-preset", name: "급여", amount: income, accountId: "acc-salary", allocations }],
    accounts: [
      { id: "acc-salary", name: "급여계좌" },
      { id: "acc-living", name: "생활비계좌" },
      { id: "acc-stock", name: "주식계좌" },
      { id: "acc-cma", name: "CMA비상금계좌" }
    ],
    transfers,
    monthlyExpense: expense,
    monthlySavings: savings,
    monthlyInvest: invest,
    expenseItems: distributeAmount(expense, EXPENSE_DETAIL.map(d => ({ ...d, accountId: "acc-living" }))),
    savingsItems: distributeAmount(savings, SAVINGS_DETAIL.map((d, idx) => ({ ...d, accountId: idx === 0 ? "acc-cma" : "acc-salary" }))),
    investItems: distributeAmount(invest, INVEST_DETAIL.map(d => ({ ...d, accountId: "acc-stock" }))),
    monthlyDebtPayment: 0,
    startCash,
    startSavings,
    startInvest,
    startDebt
  };
}

