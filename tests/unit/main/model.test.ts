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
    expect(first.updatedAt).toBe(0);
  });
});
