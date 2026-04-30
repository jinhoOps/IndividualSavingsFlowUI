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
  aggressive: { expenseRate: 0.4, savingsRate: 0.2, investRate: 0.4 }
};

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
    expenseItems: [{ id: "expense-preset", name: "생활비", amount: expense }],
    savingsItems: [{ id: "savings-preset", name: "저축", amount: savings, annualRate: 3.0 }],
    investItems: [{ id: "invest-preset", name: "투자", amount: invest }],
    monthlyDebtPayment: 0,
    startCash: 0,
    startSavings: 0,
    startInvest: 0,
    startDebt: 0
  };
}
