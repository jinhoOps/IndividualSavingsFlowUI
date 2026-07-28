import { describe, expect, it } from 'vitest';
import { calculateCashflow } from '../../../src/main/domain/cashflow';
import type { MainData } from '../../../src/main/domain/model';

const data: MainData = {
  schemaVersion: 1,
  updatedAt: 0,
  incomes: [{ id: 'salary', name: '급여', amountWon: 5_000_000, allocations: [] }],
  expenses: [{ id: 'living', name: '생활비', amountWon: 2_000_000 }],
  savings: [{ id: 'deposit', name: '적금', amountWon: 800_000 }],
  investments: [{ id: 'etf', name: 'ETF', amountWon: 700_000 }],
  accounts: [],
};

describe('calculateCashflow', () => {
  it('derives monthly income, planned outflows, and unallocated cash', () => {
    expect(calculateCashflow(data)).toEqual({
      incomeWon: 5_000_000,
      expenseWon: 2_000_000,
      savingWon: 800_000,
      investmentWon: 700_000,
      plannedOutflowWon: 3_500_000,
      availableWon: 1_500_000,
      deficitWon: 0,
    });
  });
});
