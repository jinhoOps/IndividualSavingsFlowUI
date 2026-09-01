import { describe, expect, it } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { buildCashflowBarModel } from '../../../src/main/ui/setup/cashflowBarModel';

const normalFixture: MainData = {
  schemaVersion: 2,
  updatedAt: 0,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

describe('buildCashflowBarModel', () => {
  it('keeps canonical allocations and excludes negative remaining from a deficit', () => {
    const model = buildCashflowBarModel({
      ...normalFixture,
      monthlyNetIncomeWon: 3_100_000,
      monthlyHousingWon: 700_000,
      monthlyLivingWon: 900_000,
      monthlySavingWon: 800_000,
      monthlyInvestmentWon: 900_000,
    });

    expect(model.deficitWon).toBe(200_000);
    expect(model.allocations.map(({ id }) => id)).toEqual([
      'consumption', 'saving', 'investment',
    ]);
    expect(model.allocations.map(({ startPercent, widthPercent }) => ({ startPercent, widthPercent })))
      .toEqual([
        { startPercent: 0, widthPercent: 1600 / 31 },
        { startPercent: 1600 / 31, widthPercent: 800 / 31 },
        { startPercent: 2400 / 31, widthPercent: 900 / 31 },
      ]);
  });

  it('appends remaining income in the fixed order for a normal plan', () => {
    const model = buildCashflowBarModel(normalFixture);

    expect(model).toMatchObject({ incomeWon: 3_200_000, deficitWon: 0 });
    expect(model.allocations).toEqual([
      { id: 'consumption', label: '소비', amountWon: 1_800_000, percentage: 56.25, startPercent: 0, widthPercent: 56.25 },
      { id: 'saving', label: '저축', amountWon: 300_000, percentage: 9.375, startPercent: 56.25, widthPercent: 9.375 },
      { id: 'investment', label: '투자', amountWon: 200_000, percentage: 6.25, startPercent: 65.625, widthPercent: 6.25 },
      { id: 'remaining', label: '남는 돈', amountWon: 900_000, percentage: 28.125, startPercent: 71.875, widthPercent: 28.125 },
    ]);
  });

  it('keeps a zero-width remaining allocation at exactly 100% income use', () => {
    const model = buildCashflowBarModel({
      ...normalFixture,
      monthlyInvestmentWon: 1_100_000,
    });

    expect(model.deficitWon).toBe(0);
    expect(model.allocations.at(-1)).toEqual({
      id: 'remaining',
      label: '남는 돈',
      amountWon: 0,
      percentage: 0,
      startPercent: 100,
      widthPercent: 0,
    });
  });

  it('uses null percentages and finite zero widths when income is zero', () => {
    const model = buildCashflowBarModel({
      ...normalFixture,
      monthlyNetIncomeWon: 0,
    });

    expect(model.allocations.map(({ percentage }) => percentage)).toEqual([null, null, null]);
    expect(model.allocations.map(({ widthPercent }) => widthPercent)).toEqual([0, 0, 0]);
    expect(model.allocations.every(({ startPercent, widthPercent }) => (
      Number.isFinite(startPercent) && Number.isFinite(widthPercent)
    ))).toBe(true);
  });
});
