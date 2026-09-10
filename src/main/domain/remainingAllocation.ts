import type { MainData } from './model';

export function availableRemainingWon(data: MainData): number {
  const remaining = BigInt(data.monthlyNetIncomeWon) - BigInt(data.monthlyHousingWon)
    - BigInt(data.monthlyLivingWon) - BigInt(data.monthlySavingWon) - BigInt(data.monthlyInvestmentWon);
  return Number(remaining > 0n ? remaining : 0n);
}

/** Adds to the opened plan once; a preset replaces the proposed additions. */
export function allocateRemaining(data: MainData, savingWon: number, investmentWon: number): MainData | null {
  if (![savingWon, investmentWon].every(value => Number.isSafeInteger(value) && value >= 0)) return null;
  if (BigInt(savingWon) + BigInt(investmentWon) > BigInt(availableRemainingWon(data))) return null;
  return { ...data, monthlySavingWon: data.monthlySavingWon + savingWon,
    monthlyInvestmentWon: data.monthlyInvestmentWon + investmentWon };
}
