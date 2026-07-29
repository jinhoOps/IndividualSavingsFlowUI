import type { MainData } from './model';

export interface CashflowSummary {
  incomeWon: number;
  housingWon: number;
  livingWon: number;
  consumptionWon: number;
  savingWon: number;
  investmentWon: number;
  plannedOutflowWon: number;
  remainingWon: number;
  deficitWon: number;
}

export function calculateCashflow(data: MainData): CashflowSummary {
  const consumptionWon = data.monthlyHousingWon + data.monthlyLivingWon;
  const plannedOutflowWon = consumptionWon + data.monthlySavingWon + data.monthlyInvestmentWon;
  const remainingWon = data.monthlyNetIncomeWon - plannedOutflowWon;

  return {
    incomeWon: data.monthlyNetIncomeWon,
    housingWon: data.monthlyHousingWon,
    livingWon: data.monthlyLivingWon,
    consumptionWon,
    savingWon: data.monthlySavingWon,
    investmentWon: data.monthlyInvestmentWon,
    plannedOutflowWon,
    remainingWon,
    deficitWon: Math.max(0, -remainingWon),
  };
}

export function percentageOfIncome(amountWon: number, incomeWon: number): number | null {
  return incomeWon > 0 ? (amountWon / incomeWon) * 100 : null;
}
