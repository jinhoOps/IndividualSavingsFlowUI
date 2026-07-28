import { describe, expect, it } from 'vitest';
import { validateMainData } from '../../../src/main/domain/validation';
import { createEmptyMainData } from '../../../src/main/domain/model';

describe('validateMainData', () => {
  it('rejects a monthly flow without income', () => {
    expect(validateMainData(createEmptyMainData()).issues).toContainEqual({
      path: 'incomes',
      code: 'income_required',
    });
  });

  it('rejects income allocations that do not match the income', () => {
    const invalid = createEmptyMainData();
    invalid.accounts = [{ id: 'salary-account', name: '급여통장', kind: 'income' }];
    invalid.incomes = [{
      id: 'salary',
      name: '급여',
      amountWon: 3_000_000,
      allocations: [{ accountId: 'salary-account', amountWon: 2_000_000 }],
    }];

    expect(validateMainData(invalid).issues).toContainEqual({
      path: 'incomes.salary.allocations',
      code: 'allocation_total_mismatch',
    });
  });

  it('rejects negative amounts and references to missing accounts', () => {
    const invalid = createEmptyMainData();
    invalid.incomes = [{ id: 'salary', name: '급여', amountWon: 3_000_000, allocations: [] }];
    invalid.expenses = [{ id: 'rent', name: '월세', amountWon: -800_000 }];
    invalid.savings = [{
      id: 'deposit',
      name: '적금',
      amountWon: 300_000,
      accountId: 'missing-account',
    }];

    expect(validateMainData(invalid).issues).toEqual(expect.arrayContaining([
      { path: 'expenses.rent.amountWon', code: 'amount_negative' },
      { path: 'savings.deposit.accountId', code: 'account_missing' },
    ]));
  });

  it('accepts income allocations that fully explain the income', () => {
    const valid = createEmptyMainData();
    valid.accounts = [{ id: 'salary-account', name: '급여통장', kind: 'income' }];
    valid.incomes = [{
      id: 'salary',
      name: '급여',
      amountWon: 3_000_000,
      allocations: [{ accountId: 'salary-account', amountWon: 3_000_000 }],
    }];

    expect(validateMainData(valid)).toEqual({ valid: true, issues: [] });
  });
});
