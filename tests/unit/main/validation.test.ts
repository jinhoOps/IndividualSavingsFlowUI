import { describe, expect, it } from 'vitest';
import { createEmptyMainData } from '../../../src/main/domain/model';
import { validateMainData } from '../../../src/main/domain/validation';

describe('validateMainData', () => {
  it('rejects zero monthly net income', () => {
    expect(validateMainData(createEmptyMainData()).issues).toContainEqual({
      path: 'monthlyNetIncomeWon',
      code: 'income_required',
    });
  });

  it.each([
    'monthlyNetIncomeWon',
    'monthlyHousingWon',
    'monthlyLivingWon',
    'monthlySavingWon',
    'monthlyInvestmentWon',
  ] as const)('rejects a negative %s amount', (field) => {
    const data = createEmptyMainData();
    data.monthlyNetIncomeWon = 1;
    data[field] = -1;

    expect(validateMainData(data).issues).toContainEqual({
      path: field,
      code: 'amount_negative',
    });
  });

  it('accepts an exact 100 percent plan', () => {
    const data = createEmptyMainData();
    data.monthlyNetIncomeWon = 1_000_000;
    data.monthlyHousingWon = 400_000;
    data.monthlyLivingWon = 300_000;
    data.monthlySavingWon = 200_000;
    data.monthlyInvestmentWon = 100_000;

    expect(validateMainData(data)).toEqual({ valid: true, issues: [] });
  });

  it('accepts a plan over 100 percent of income', () => {
    const data = createEmptyMainData();
    data.monthlyNetIncomeWon = 1_000_000;
    data.monthlyHousingWon = 1_000_001;

    expect(validateMainData(data)).toEqual({ valid: true, issues: [] });
  });
});
