import { describe, expect, it } from 'vitest';
import { createEmptyMainData } from '../../../src/main/domain/model';
import { validateMainData, validateMainDraft } from '../../../src/main/domain/validation';

describe('validateMainData', () => {
  it('permits zero income in an otherwise valid setup draft', () => {
    expect(validateMainDraft(createEmptyMainData())).toEqual({ valid: true, issues: [] });
  });

  it.each([
    ['monthlyNetIncomeWon', -1, 'amount_negative'],
    ['monthlyNetIncomeWon', 0.5, 'amount_not_safe_integer'],
    ['monthlyNetIncomeWon', Number.MAX_SAFE_INTEGER + 1, 'amount_not_safe_integer'],
    ['monthlyHousingWon', -1, 'amount_negative'],
    ['monthlyHousingWon', 0.5, 'amount_not_safe_integer'],
    ['monthlyHousingWon', Number.MAX_SAFE_INTEGER + 1, 'amount_not_safe_integer'],
    ['monthlyLivingWon', -1, 'amount_negative'],
    ['monthlyLivingWon', 0.5, 'amount_not_safe_integer'],
    ['monthlyLivingWon', Number.MAX_SAFE_INTEGER + 1, 'amount_not_safe_integer'],
    ['monthlySavingWon', -1, 'amount_negative'],
    ['monthlySavingWon', 0.5, 'amount_not_safe_integer'],
    ['monthlySavingWon', Number.MAX_SAFE_INTEGER + 1, 'amount_not_safe_integer'],
    ['monthlyInvestmentWon', -1, 'amount_negative'],
    ['monthlyInvestmentWon', 0.5, 'amount_not_safe_integer'],
    ['monthlyInvestmentWon', Number.MAX_SAFE_INTEGER + 1, 'amount_not_safe_integer'],
  ] as const)('rejects invalid setup draft money %s=%s', (field, amountWon, code) => {
    const draft = createEmptyMainData();
    draft[field] = amountWon;

    expect(validateMainDraft(draft).issues).toContainEqual({ path: field, code });
  });

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
