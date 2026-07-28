import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUTS } from '../../../apps/main/modules/constants.js';
import { migrateLegacyMain } from '../../../src/main/infrastructure/legacyMigration';

describe('migrateLegacyMain', () => {
  it('maps isf-rebuild-v1 fields without mutating the source', () => {
    const legacy = {
      modelVersion: 10,
      incomes: [{
        id: 'income-main',
        name: '급여',
        amount: 4_200_000,
        accountId: 'acc-salary',
        allocations: [{ accountId: 'acc-salary', amount: 4_200_000 }],
      }],
      expenseItems: [{ id: 'rent', name: '주거비', amount: 900_000, group: '고정비' }],
      savingsItems: [{ id: 'saving', name: '적금', amount: 600_000, maturityMonth: '2028-12' }],
      investItems: [{ id: 'invest', name: 'ETF', amount: 800_000 }],
      accounts: [{ id: 'acc-salary', name: '급여통장', type: 'income' }],
    };
    const snapshot = structuredClone(legacy);

    const result = migrateLegacyMain(legacy);

    expect(result.status).toBe('migrated');
    expect(result.data?.incomes[0].amountWon).toBe(4_200_000);
    expect(result.data?.expenses[0].group).toBe('고정비');
    expect(result.data?.savings[0].maturityMonth).toBe('2028-12');
    expect(legacy).toEqual(snapshot);
  });

  it('migrates the real persisted defaults whose accounts omit type metadata', () => {
    const legacy = structuredClone(DEFAULT_INPUTS);

    const result = migrateLegacyMain(legacy);

    expect(result.status).toBe('migrated');
    expect(result.data?.accounts).toEqual([
      { id: 'acc-salary', name: '급여계좌', kind: 'income' },
      { id: 'acc-living', name: '생활비계좌', kind: 'spending' },
      { id: 'acc-stock', name: '투자계좌', kind: 'investment' },
    ]);
  });

  it('uses the other account kind when an untyped legacy id has no known role', () => {
    const result = migrateLegacyMain({
      modelVersion: 10,
      incomes: [{ id: 'income-main', name: '급여', amount: 1_000_000, allocations: [] }],
      expenseItems: [],
      savingsItems: [],
      investItems: [],
      accounts: [{ id: 'custom-account', name: '기타통장' }],
    });

    expect(result.data?.accounts).toEqual([
      { id: 'custom-account', name: '기타통장', kind: 'other' },
    ]);
  });

  it('normalizes pre-v10 item and allocation amounts from 만원 to won', () => {
    const result = migrateLegacyMain({
      modelVersion: 9,
      incomes: [{
        id: 'income-main',
        name: '급여',
        amount: 420,
        accountId: 'acc-salary',
        allocations: [{ accountId: 'acc-salary', amount: 420 }],
      }],
      expenseItems: [{ id: 'rent', name: '월세', amount: 90 }],
      savingsItems: [{ id: 'saving', name: '적금', amount: 60 }],
      investItems: [{ id: 'invest', name: 'ETF', amount: 80 }],
      accounts: [{ id: 'acc-salary', name: '급여통장', type: 'income' }],
    });

    expect(result.data).toMatchObject({
      incomes: [{
        amountWon: 4_200_000,
        allocations: [{ accountId: 'acc-salary', amountWon: 4_200_000 }],
      }],
      expenses: [{ amountWon: 900_000 }],
      savings: [{ amountWon: 600_000 }],
      investments: [{ amountWon: 800_000 }],
    });
  });

  it('returns a serializable recovery value for malformed legacy data', () => {
    const result = migrateLegacyMain({ incomes: 'not-an-array' });

    expect(result).toMatchObject({ status: 'failed' });
    expect(() => JSON.stringify(result.original)).not.toThrow();
  });
});
