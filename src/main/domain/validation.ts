import type { FinancialItem, IncomeItem, MainData } from './model';

export type ValidationCode =
  | 'income_required'
  | 'name_required'
  | 'amount_negative'
  | 'account_missing'
  | 'allocation_total_mismatch';

export interface ValidationResult {
  valid: boolean;
  issues: { path: string; code: ValidationCode }[];
}

type Issue = ValidationResult['issues'][number];

export function validateMainData(data: MainData): ValidationResult {
  const issues: Issue[] = [];
  const accountIds = new Set(data.accounts.map((account) => account.id));

  if (data.incomes.length === 0) {
    issues.push({ path: 'incomes', code: 'income_required' });
  }

  for (const account of data.accounts) {
    if (account.name.trim() === '') {
      issues.push({ path: `accounts.${account.id}.name`, code: 'name_required' });
    }
  }

  validateItems('incomes', data.incomes, accountIds, issues);
  validateItems('expenses', data.expenses, accountIds, issues);
  validateItems('savings', data.savings, accountIds, issues);
  validateItems('investments', data.investments, accountIds, issues);

  for (const income of data.incomes) {
    validateAllocations(income, accountIds, issues);
  }

  return { valid: issues.length === 0, issues };
}

function validateItems(
  group: 'incomes' | 'expenses' | 'savings' | 'investments',
  items: FinancialItem[],
  accountIds: Set<string>,
  issues: Issue[],
): void {
  for (const item of items) {
    if (item.name.trim() === '') {
      issues.push({ path: `${group}.${item.id}.name`, code: 'name_required' });
    }
    if (item.amountWon < 0) {
      issues.push({ path: `${group}.${item.id}.amountWon`, code: 'amount_negative' });
    }
    if (item.accountId !== undefined && !accountIds.has(item.accountId)) {
      issues.push({ path: `${group}.${item.id}.accountId`, code: 'account_missing' });
    }
  }
}

function validateAllocations(income: IncomeItem, accountIds: Set<string>, issues: Issue[]): void {
  const path = `incomes.${income.id}.allocations`;
  const allocationWon = income.allocations.reduce((sum, allocation) => {
    if (allocation.amountWon < 0) {
      issues.push({ path, code: 'amount_negative' });
    }
    if (!accountIds.has(allocation.accountId)) {
      issues.push({ path, code: 'account_missing' });
    }
    return sum + allocation.amountWon;
  }, 0);

  if (income.allocations.length > 0 && allocationWon !== income.amountWon) {
    issues.push({ path, code: 'allocation_total_mismatch' });
  }
}
