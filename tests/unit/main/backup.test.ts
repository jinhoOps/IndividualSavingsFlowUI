import { describe, expect, it } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import { exportMainData, importMainData } from '../../../src/main/infrastructure/backup';

describe('Main JSON backup', () => {
  it('round-trips a current MainData document without changing it', () => {
    const data: MainData = {
      schemaVersion: 1,
      updatedAt: 42,
      incomes: [{
        id: 'salary',
        name: '급여',
        amountWon: 4_200_000,
        accountId: 'salary-account',
        allocations: [{ accountId: 'salary-account', amountWon: 4_200_000 }],
      }],
      expenses: [],
      savings: [],
      investments: [],
      accounts: [{ id: 'salary-account', name: '급여통장', kind: 'income' }],
    };

    expect(importMainData(exportMainData(data))).toStrictEqual(data);
  });

  it('rejects malformed JSON', () => {
    expect(() => importMainData('{bad')).toThrow('Backup data is not valid JSON.');
  });
});
