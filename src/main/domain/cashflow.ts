import type { MainData } from './model';

export interface CashflowSummary {
  incomeWon: number;
  expenseWon: number;
  savingWon: number;
  investmentWon: number;
  plannedOutflowWon: number;
  availableWon: number;
  deficitWon: number;
}

const total = (items: { amountWon: number }[]) =>
  items.reduce((sum, item) => sum + Math.max(0, item.amountWon), 0);

export function calculateCashflow(data: MainData): CashflowSummary {
  const incomeWon = total(data.incomes);
  const expenseWon = total(data.expenses);
  const savingWon = total(data.savings);
  const investmentWon = total(data.investments);
  const plannedOutflowWon = expenseWon + savingWon + investmentWon;

  return {
    incomeWon,
    expenseWon,
    savingWon,
    investmentWon,
    plannedOutflowWon,
    availableWon: Math.max(0, incomeWon - plannedOutflowWon),
    deficitWon: Math.max(0, plannedOutflowWon - incomeWon),
  };
}
