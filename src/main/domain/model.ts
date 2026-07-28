export type ItemKind = 'income' | 'expense' | 'saving' | 'investment';
export type SetupStep = 'welcome' | 'income' | 'expense' | 'saving-investment' | 'account' | 'review';

export interface FinancialItem {
  id: string;
  name: string;
  amountWon: number;
  group?: string;
  accountId?: string;
  annualRate?: number;
  maturityMonth?: string;
}

export interface IncomeAllocation {
  accountId: string;
  amountWon: number;
}

export interface IncomeItem extends FinancialItem {
  allocations: IncomeAllocation[];
}

export interface Account {
  id: string;
  name: string;
  kind: 'income' | 'spending' | 'saving' | 'investment' | 'other';
}

export interface MainData {
  schemaVersion: 1;
  updatedAt: number;
  incomes: IncomeItem[];
  expenses: FinancialItem[];
  savings: FinancialItem[];
  investments: FinancialItem[];
  accounts: Account[];
}

export function createEmptyMainData(): MainData {
  return {
    schemaVersion: 1,
    updatedAt: 0,
    incomes: [],
    expenses: [],
    savings: [],
    investments: [],
    accounts: [],
  };
}
