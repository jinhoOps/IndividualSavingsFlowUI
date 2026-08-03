import { describe, expect, it } from 'vitest';
import {
  calculateCashflowInsight,
  classifyInvestmentSavingBand,
  classifySavingsInvestmentBand,
} from '../../../src/main/domain/cashflowInsight';
import type { MainData } from '../../../src/main/domain/model';

const appliedData: MainData = {
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

describe('classifySavingsInvestmentBand', () => {
  it.each([
    [49.9, 'under-50'], [50, 'under-60'], [59.9, 'under-60'],
    [60, 'under-70'], [80, 'under-90'], [90, 'at-least-90'],
  ] as const)('classifies savings and investment total %s', (percentage, expected) => {
    expect(classifySavingsInvestmentBand(percentage)).toBe(expected);
  });
});

describe('classifyInvestmentSavingBand', () => {
  it.each([
    [100, 0, 'below-1-to-3'], [0, 100, 'above-3-to-1'], [0, 0, 'unset'],
    [120, 40, 'near-1-to-3'], [100, 50, 'near-1-to-2'],
    [100, 100, 'near-1-to-1'], [50, 100, 'near-2-to-1'],
    [40, 120, 'near-3-to-1'],
    [12, 5, 'near-1-to-2'], [4, 3, 'near-1-to-1'],
    [2, 3, 'near-2-to-1'], [2, 5, 'near-3-to-1'],
  ] as const)('classifies saving %s and investment %s', (savingWon, investmentWon, expected) => {
    expect(classifyInvestmentSavingBand(savingWon, investmentWon)).toBe(expected);
  });
});

describe('calculateCashflowInsight', () => {
  it('derives normal allocations and savings-investment context', () => {
    const insight = calculateCashflowInsight(appliedData);

    expect(insight).toMatchObject({
      savingsInvestmentPercentage: 15.625,
      savingsInvestmentBand: 'under-50',
      investmentSavingRatio: 2 / 3,
      investmentSavingBand: 'near-1-to-2',
      isOverIncome: false,
    });
    expect(insight.allocations).toEqual([
      expect.objectContaining({ id: 'consumption', percentage: 56.25, displayPercentage: 56.25 }),
      expect.objectContaining({ id: 'saving', percentage: 9.375, displayPercentage: 9.375 }),
      expect.objectContaining({ id: 'investment', percentage: 6.25, displayPercentage: 6.25 }),
      expect.objectContaining({ id: 'remaining', percentage: 28.125, displayPercentage: 28.125 }),
    ]);
  });

  it('does not classify the savings-investment percentage without income', () => {
    const zeroIncome: MainData = {
      ...appliedData,
      monthlyNetIncomeWon: 0,
    };

    expect(calculateCashflowInsight(zeroIncome).savingsInvestmentPercentage).toBeNull();
  });

  it('normalizes zero-income planned allocations into a complete display ring', () => {
    const zeroIncomeWithPlan: MainData = {
      ...appliedData,
      monthlyNetIncomeWon: 0,
      monthlyHousingWon: 60,
      monthlyLivingWon: 0,
      monthlySavingWon: 40,
      monthlyInvestmentWon: 0,
    };

    expect(calculateCashflowInsight(zeroIncomeWithPlan).allocations).toEqual([
      expect.objectContaining({ id: 'consumption', percentage: 0, displayPercentage: 60 }),
      expect.objectContaining({ id: 'saving', percentage: 0, displayPercentage: 40 }),
      expect.objectContaining({ id: 'investment', percentage: 0, displayPercentage: 0 }),
    ]);
  });

  it('keeps deficit allocations at their actual income percentages without a negative remaining segment', () => {
    const deficitData: MainData = {
      ...appliedData,
      monthlyNetIncomeWon: 100,
      monthlyHousingWon: 70,
      monthlyLivingWon: 0,
      monthlySavingWon: 30,
      monthlyInvestmentWon: 30,
    };
    const insight = calculateCashflowInsight(deficitData);

    expect(insight.isOverIncome).toBe(true);
    expect(insight.allocations).toEqual([
      expect.objectContaining({ id: 'consumption', percentage: 70, displayPercentage: 70 }),
      expect.objectContaining({ id: 'saving', percentage: 30, displayPercentage: 30 }),
      expect.objectContaining({ id: 'investment', percentage: 30, displayPercentage: 30 }),
    ]);
    expect(insight.allocations.reduce((total, allocation) => total + allocation.displayPercentage, 0)).toBe(130);
  });
});
