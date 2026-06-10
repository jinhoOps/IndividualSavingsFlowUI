export const PRESET_SALARIES = [
  { label: '3,000만원', value: 30000000, monthlyIncome: 2250000 },
  { label: '4,000만원', value: 40000000, monthlyIncome: 2950000 },
  { label: '5,000만원', value: 50000000, monthlyIncome: 3550000 },
  { label: '6,000만원', value: 60000000, monthlyIncome: 4200000 },
  { label: '7,000만원', value: 70000000, monthlyIncome: 4850000 },
  { label: '8,000만원', value: 80000000, monthlyIncome: 5400000 },
  { label: '9,000만원', value: 90000000, monthlyIncome: 6000000 },
  { label: '10,000만원', value: 100000000, monthlyIncome: 6550000 }
];

export const PRESET_STYLES = {
  conservative: { expenseRate: 0.5, savingsRate: 0.4, investRate: 0.1 },
  neutral: { expenseRate: 0.5, savingsRate: 0.3, investRate: 0.2 },
  aggressive: { expenseRate: 0.4, savingsRate: 0.1, investRate: 0.5 }
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

  return {
    incomes: [{ id: "income-preset", name: "급여", amount: income }],
    monthlyExpense: expense,
    monthlySavings: savings,
    monthlyInvest: invest,
    expenseItems: distributeAmount(expense, EXPENSE_DETAIL),
    savingsItems: distributeAmount(savings, SAVINGS_DETAIL),
    investItems: distributeAmount(invest, INVEST_DETAIL),
    monthlyDebtPayment: 0,
    startCash: 0,
    startSavings: 0,
    startInvest: 0,
    startDebt: 0
  };
}

