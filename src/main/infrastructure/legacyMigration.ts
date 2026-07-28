import type { Account, FinancialItem, IncomeAllocation, IncomeItem, MainData } from '../domain/model';
import { validateMainData } from '../domain/validation';

export type MigrationResult =
  | { status: 'empty'; data: null; original: null }
  | { status: 'current'; data: MainData; original: unknown }
  | { status: 'migrated'; data: MainData; original: unknown }
  | { status: 'recovery'; data: MainData; original: unknown; current: MainData }
  | { status: 'failed'; data: null; original: unknown; reason: string };

type UnknownRecord = Record<string, unknown>;

export function migrateLegacyMain(input: unknown): MigrationResult {
  if (input === null || input === undefined) {
    return { status: 'empty', data: null, original: null };
  }

  const original = toSerializable(input);

  if (isMainDataShape(input)) {
    const data = cloneMainData(input);
    const validation = validateMainData(data);
    return validation.valid
      ? { status: 'current', data, original }
      : { status: 'failed', data: null, original, reason: validationReason(validation.issues) };
  }

  if (!isRecord(input)) {
    return { status: 'failed', data: null, original, reason: 'Legacy data must be an object.' };
  }

  const data = migrateLegacyRecord(input);
  if (data === null) {
    return { status: 'failed', data: null, original, reason: 'Legacy data has an unsupported shape.' };
  }

  const validation = validateMainData(data);
  return validation.valid
    ? { status: 'migrated', data, original }
    : { status: 'failed', data: null, original, reason: validationReason(validation.issues) };
}

export function isMainDataShape(value: unknown): value is MainData {
  if (!isRecord(value)
    || value.schemaVersion !== 1
    || !isFiniteNumber(value.updatedAt)
    || !Array.isArray(value.incomes)
    || !Array.isArray(value.expenses)
    || !Array.isArray(value.savings)
    || !Array.isArray(value.investments)
    || !Array.isArray(value.accounts)) {
    return false;
  }

  return value.incomes.every(isIncomeItem)
    && value.expenses.every(isFinancialItem)
    && value.savings.every(isFinancialItem)
    && value.investments.every(isFinancialItem)
    && value.accounts.every(isAccount);
}

function migrateLegacyRecord(input: UnknownRecord): MainData | null {
  const incomes = mapArray(input.incomes, migrateIncome);
  const expenses = mapArray(input.expenseItems, migrateFinancialItem);
  const savings = mapArray(input.savingsItems, migrateFinancialItem);
  const investments = mapArray(input.investItems, migrateFinancialItem);
  const accounts = mapArray(input.accounts, migrateAccount);

  if (incomes === null || expenses === null || savings === null || investments === null || accounts === null) {
    return null;
  }

  return {
    schemaVersion: 1,
    updatedAt: Date.now(),
    incomes,
    expenses,
    savings,
    investments,
    accounts,
  };
}

function migrateIncome(value: unknown): IncomeItem | null {
  if (!isRecord(value) || !Array.isArray(value.allocations)) return null;

  const item = migrateFinancialItem(value);
  const allocations = mapArray(value.allocations, migrateAllocation);
  return item === null || allocations === null ? null : { ...item, allocations };
}

function migrateFinancialItem(value: unknown): FinancialItem | null {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name) || !isFiniteNumber(value.amount)) {
    return null;
  }

  if (!isOptionalString(value.group)
    || !isOptionalString(value.accountId)
    || !isOptionalFiniteNumber(value.annualRate)
    || !isOptionalString(value.maturityMonth)) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    amountWon: value.amount,
    ...(value.group === undefined ? {} : { group: value.group }),
    ...(value.accountId === undefined ? {} : { accountId: value.accountId }),
    ...(value.annualRate === undefined ? {} : { annualRate: value.annualRate }),
    ...(value.maturityMonth === undefined ? {} : { maturityMonth: value.maturityMonth }),
  };
}

function migrateAllocation(value: unknown): IncomeAllocation | null {
  if (!isRecord(value) || !isString(value.accountId) || !isFiniteNumber(value.amount)) return null;
  return { accountId: value.accountId, amountWon: value.amount };
}

function migrateAccount(value: unknown): Account | null {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name)) return null;

  const kind = value.kind ?? value.type;
  if (!isAccountKind(kind)) return null;
  return { id: value.id, name: value.name, kind };
}

function isIncomeItem(value: unknown): value is IncomeItem {
  return isFinancialItem(value) && isRecord(value) && Array.isArray(value.allocations) && value.allocations.every(isAllocation);
}

function isFinancialItem(value: unknown): value is FinancialItem {
  return isRecord(value)
    && isString(value.id)
    && isString(value.name)
    && isFiniteNumber(value.amountWon)
    && isOptionalString(value.group)
    && isOptionalString(value.accountId)
    && isOptionalFiniteNumber(value.annualRate)
    && isOptionalString(value.maturityMonth);
}

function isAllocation(value: unknown): value is IncomeAllocation {
  return isRecord(value) && isString(value.accountId) && isFiniteNumber(value.amountWon);
}

function isAccount(value: unknown): value is Account {
  return isRecord(value)
    && isString(value.id)
    && isString(value.name)
    && isAccountKind(value.kind);
}

function mapArray<T>(value: unknown, map: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const mapped: T[] = [];
  for (const entry of value) {
    const next = map(entry);
    if (next === null) return null;
    mapped.push(next);
  }
  return mapped;
}

function cloneMainData(data: MainData): MainData {
  return {
    ...data,
    incomes: data.incomes.map((income) => ({
      ...income,
      allocations: income.allocations.map((allocation) => ({ ...allocation })),
    })),
    expenses: data.expenses.map((item) => ({ ...item })),
    savings: data.savings.map((item) => ({ ...item })),
    investments: data.investments.map((item) => ({ ...item })),
    accounts: data.accounts.map((account) => ({ ...account })),
  };
}

function validationReason(issues: { path: string; code: string }[]): string {
  return `Main data validation failed: ${issues.map((issue) => `${issue.path}:${issue.code}`).join(', ')}`;
}

function toSerializable(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function' || typeof value === 'undefined') {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value.map((entry) => toSerializable(entry, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const serialized: UnknownRecord = {};
    try {
      for (const [key, entry] of Object.entries(value)) {
        serialized[key] = toSerializable(entry, seen);
      }
      return serialized;
    } catch {
      return '[Unserializable object]';
    }
  }
  return String(value);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isAccountKind(value: unknown): value is Account['kind'] {
  return value === 'income'
    || value === 'spending'
    || value === 'saving'
    || value === 'investment'
    || value === 'other';
}
