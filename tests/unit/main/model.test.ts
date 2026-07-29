import { describe, expect, it } from 'vitest';
import { createEmptyMainData } from '../../../src/main/domain/model';

describe('createEmptyMainData', () => {
  it('creates a blank scalar schema v2 draft', () => {
    expect(createEmptyMainData()).toEqual({
      schemaVersion: 2,
      updatedAt: 0,
      monthlyNetIncomeWon: 0,
      monthlyHousingWon: 0,
      monthlyLivingWon: 0,
      monthlySavingWon: 0,
      monthlyInvestmentWon: 0,
    });
  });
});
