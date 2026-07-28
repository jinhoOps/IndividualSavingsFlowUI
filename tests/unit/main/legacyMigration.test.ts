import { describe, expect, it } from 'vitest';
import { migrateLegacyMain } from '../../../src/main/infrastructure/legacyMigration';

describe('migrateLegacyMain', () => {
  it('maps isf-rebuild-v1 fields without mutating the source', () => {
    const legacy = {
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

  it('returns a serializable recovery value for malformed legacy data', () => {
    const result = migrateLegacyMain({ incomes: 'not-an-array' });

    expect(result).toMatchObject({ status: 'failed' });
    expect(() => JSON.stringify(result.original)).not.toThrow();
  });
});
