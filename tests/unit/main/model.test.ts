import { describe, expect, it } from 'vitest';
import { createEmptyMainData } from '../../../src/main/domain/model';

describe('createEmptyMainData', () => {
  it('creates a versioned empty draft without shared arrays', () => {
    const first = createEmptyMainData();
    const second = createEmptyMainData();

    expect(first).toMatchObject({
      schemaVersion: 1,
      incomes: [],
      expenses: [],
      savings: [],
      investments: [],
      accounts: [],
    });
    expect(first.incomes).not.toBe(second.incomes);
    expect(first.expenses).not.toBe(second.expenses);
    expect(first.savings).not.toBe(second.savings);
    expect(first.investments).not.toBe(second.investments);
    expect(first.accounts).not.toBe(second.accounts);
    expect(first.updatedAt).toBe(0);
  });
});
