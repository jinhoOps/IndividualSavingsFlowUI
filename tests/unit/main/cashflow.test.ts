import { describe, expect, it } from 'vitest';
import { calculateCashflow, percentageOfIncome } from '../../../src/main/domain/cashflow';
import type { MainData } from '../../../src/main/domain/model';

const data: MainData = {
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

describe('calculateCashflow', () => {
  it('derives scalar monthly cashflow totals and remaining income', () => {
    expect(calculateCashflow(data)).toEqual({
      incomeWon: 3_200_000,
      housingWon: 800_000,
      livingWon: 1_000_000,
      consumptionWon: 1_800_000,
      savingWon: 300_000,
      investmentWon: 200_000,
      plannedOutflowWon: 2_300_000,
      remainingWon: 900_000,
      deficitWon: 0,
    });
  });
});

describe('percentageOfIncome', () => {
  it('calculates a percentage when income is positive', () => {
    expect(percentageOfIncome(1_800_000, 3_200_000)).toBeCloseTo(56.25);
  });

  it('returns null when income is zero', () => {
    expect(percentageOfIncome(1, 0)).toBeNull();
  });
});
