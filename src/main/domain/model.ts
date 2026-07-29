export type SetupStep = 'welcome' | 'income' | 'housing' | 'living' | 'saving-investment' | 'review';

export interface MainData {
  schemaVersion: 2;
  updatedAt: number;
  monthlyNetIncomeWon: number;
  monthlyHousingWon: number;
  monthlyLivingWon: number;
  monthlySavingWon: number;
  monthlyInvestmentWon: number;
}

export function createEmptyMainData(): MainData {
  return {
    schemaVersion: 2,
    updatedAt: 0,
    monthlyNetIncomeWon: 0,
    monthlyHousingWon: 0,
    monthlyLivingWon: 0,
    monthlySavingWon: 0,
    monthlyInvestmentWon: 0,
  };
}
