import { isfStore, type IsfStore } from '../../core/storage/IsfStore';
import type { MainData, SetupStep } from '../domain/model';
import { validateMainData } from '../domain/validation';
import { isMainDataShape, migrateLegacyMain, type MigrationResult } from './legacyMigration';

const MAIN_KEY = 'isf-main-v1';
const PENDING_KEY = 'isf-main-v1-pending';
const LEGACY_KEY = 'isf-rebuild-v1';
const LEGACY_ACTIVE_KEY = 'isf-step1-active';
const SETUP_PROGRESS_KEY = 'isf-main-v1-setup-progress';

const setupSteps = new Set<SetupStep>(['welcome', 'income', 'expense', 'saving-investment', 'account', 'review']);
let lastIssuedUpdatedAt = 0;
let activeMainSaves = 0;

export interface MainRepository {
  load(): Promise<MigrationResult>;
  save(data: MainData): Promise<MainData>;
  saveSetupProgress(step: SetupStep, draft: MainData, kind?: SetupProgressKind): void;
  loadSetupProgress(): SetupProgress | null;
  clearSetupProgress(): void;
  discardPending(): void;
}

export type SetupProgressKind = 'initial' | 'restart';

export interface SetupProgress {
  kind: SetupProgressKind;
  step: SetupStep;
  draft: MainData;
}

export type MainHistoryStore = Pick<IsfStore, 'saveMainV1'>;

export class BrowserMainRepository implements MainRepository {
  constructor(private readonly historyStore: MainHistoryStore = isfStore) {}

  async load(): Promise<MigrationResult> {
    const currentRaw = window.localStorage.getItem(MAIN_KEY);
    const pendingRaw = window.localStorage.getItem(PENDING_KEY);
    const current = currentRaw === null ? null : migrateStored(currentRaw);
    const pending = pendingRaw === null ? null : migrateStored(pendingRaw);

    if (current?.data != null && pending?.data != null) {
      return {
        status: 'recovery',
        data: pending.data,
        original: pending.original,
        current: current.data,
      };
    }
    if (current !== null) return current;

    if (pending !== null) return pending;

    const legacy = window.localStorage.getItem(LEGACY_KEY);
    return legacy === null ? migrateLegacyMain(null) : migrateStored(legacy);
  }

  async save(data: MainData): Promise<MainData> {
    const validation = validateMainData(data);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid main data: ${validation.issues.map((issue) => issue.code).join(', ')}`);
    }

    const next = cloneMainData(data);
    next.updatedAt = this.nextUpdatedAt();
    let previousCurrent: string | null = null;
    let previousLegacy: string | null = null;
    let previousLegacyActive: string | null = null;
    let currentWritten = false;
    let legacyWritten = false;
    let legacyActiveWritten = false;

    try {
      const serialized = JSON.stringify(next);
      previousCurrent = window.localStorage.getItem(MAIN_KEY);
      previousLegacy = window.localStorage.getItem(LEGACY_KEY);
      previousLegacyActive = window.localStorage.getItem(LEGACY_ACTIVE_KEY);
      const compatibility = JSON.stringify(createLegacyProjection(
        next,
        previousLegacy,
      ));
      await this.historyStore.saveMainV1(next);
      window.localStorage.setItem(PENDING_KEY, serialized);
      window.localStorage.setItem(MAIN_KEY, serialized);
      currentWritten = true;
      window.localStorage.setItem(LEGACY_KEY, compatibility);
      legacyWritten = true;
      window.localStorage.setItem(LEGACY_ACTIVE_KEY, compatibility);
      legacyActiveWritten = true;
      window.localStorage.removeItem(PENDING_KEY);
      return next;
    } catch (error) {
      if (legacyActiveWritten) restoreStorageValue(LEGACY_ACTIVE_KEY, previousLegacyActive);
      if (legacyWritten) restoreStorageValue(LEGACY_KEY, previousLegacy);
      if (currentWritten) restoreStorageValue(MAIN_KEY, previousCurrent);
      throw error;
    } finally {
      activeMainSaves--;
    }
  }

  saveSetupProgress(step: SetupStep, draft: MainData, kind: SetupProgressKind = 'initial'): void {
    window.localStorage.setItem(SETUP_PROGRESS_KEY, JSON.stringify({ kind, step, draft: cloneMainData(draft) }));
  }

  loadSetupProgress(): SetupProgress | null {
    const stored = window.localStorage.getItem(SETUP_PROGRESS_KEY);
    if (stored === null) return null;

    try {
      const parsed: unknown = JSON.parse(stored);
      if (!isSetupProgress(parsed)) return null;
      return {
        kind: parsed.kind === 'restart' ? 'restart' : 'initial',
        step: parsed.step,
        draft: cloneMainData(parsed.draft),
      };
    } catch {
      return null;
    }
  }

  clearSetupProgress(): void {
    window.localStorage.removeItem(SETUP_PROGRESS_KEY);
  }

  discardPending(): void {
    window.localStorage.removeItem(PENDING_KEY);
  }

  private nextUpdatedAt(): number {
    const persistedUpdatedAt = readStoredUpdatedAt(window.localStorage.getItem(MAIN_KEY));
    if (persistedUpdatedAt === 0 && activeMainSaves === 0) {
      lastIssuedUpdatedAt = 0;
    }
    const updatedAt = Math.max(Date.now(), persistedUpdatedAt + 1, lastIssuedUpdatedAt + 1);
    lastIssuedUpdatedAt = updatedAt;
    activeMainSaves++;
    return updatedAt;
  }
}

function migrateStored(raw: string): MigrationResult {
  try {
    return migrateLegacyMain(JSON.parse(raw));
  } catch {
    return { status: 'failed', data: null, original: raw, reason: 'Stored main data is not valid JSON.' };
  }
}

function isSetupProgress(value: unknown): value is {
  kind?: SetupProgressKind;
  step: SetupStep;
  draft: MainData;
} {
  if (!isRecord(value) || typeof value.step !== 'string' || !setupSteps.has(value.step as SetupStep)) return false;
  if (value.kind !== undefined && value.kind !== 'initial' && value.kind !== 'restart') return false;
  return isMainDataShape(value.draft);
}

function createLegacyProjection(data: MainData, previousRaw: string | null): Record<string, unknown> {
  const previous = parseRecord(previousRaw);
  const accounts = data.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.kind,
  }));
  const incomeItems = data.incomes.map((income) => ({
    id: income.id,
    name: income.name,
    amount: income.amountWon,
    ...(income.group === undefined ? {} : { group: income.group }),
    ...(income.accountId === undefined ? {} : { accountId: income.accountId }),
    allocations: income.allocations.map((allocation) => ({
      accountId: allocation.accountId,
      amount: allocation.amountWon,
    })),
  }));

  return {
    modelVersion: 10,
    version: 2,
    updatedAt: data.updatedAt,
    incomes: incomeItems,
    expenseItems: projectFinancialItems(data.expenses),
    savingsItems: projectFinancialItems(data.savings),
    investItems: projectFinancialItems(data.investments),
    accounts,
    transfers: [],
    splitIncomeAccounts: data.incomes.some((income) => income.allocations.length > 1),
    surplusTransferAccountId: validAccountId(previous.surplusTransferAccountId, data)
      ?? data.accounts[0]?.id
      ?? '',
    monthlyIncome: sumAmounts(data.incomes),
    monthlyExpense: sumAmounts(data.expenses),
    monthlySavings: sumAmounts(data.savings),
    monthlyInvest: sumAmounts(data.investments),
    monthlyDebtPayment: finiteNumber(previous.monthlyDebtPayment, 0),
    startCash: finiteNumber(previous.startCash, 0),
    startSavings: finiteNumber(previous.startSavings, 0),
    startInvest: finiteNumber(previous.startInvest, 0),
    startDebt: finiteNumber(previous.startDebt, 0),
    annualIncomeGrowth: finiteNumber(previous.annualIncomeGrowth, 4),
    annualExpenseGrowth: finiteNumber(previous.annualExpenseGrowth, 2.5),
    annualSavingsYield: finiteNumber(previous.annualSavingsYield, 3),
    annualInvestReturn: finiteNumber(previous.annualInvestReturn, 9.5),
    annualDebtInterest: finiteNumber(previous.annualDebtInterest, 5.2),
    horizonYears: finiteNumber(previous.horizonYears, 5),
  };
}

function projectFinancialItems(items: MainData['expenses']): Array<Record<string, unknown>> {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    amount: item.amountWon,
    ...(item.group === undefined ? {} : { group: item.group }),
    ...(item.accountId === undefined ? {} : { accountId: item.accountId }),
    ...(item.annualRate === undefined ? {} : { annualRate: item.annualRate }),
    ...(item.maturityMonth === undefined ? {} : { maturityMonth: item.maturityMonth }),
  }));
}

function sumAmounts(items: Array<{ amountWon: number }>): number {
  return items.reduce((sum, item) => sum + item.amountWon, 0);
}

function parseRecord(raw: string | null): Record<string, unknown> {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function validAccountId(value: unknown, data: MainData): string | null {
  return typeof value === 'string' && data.accounts.some((account) => account.id === value)
    ? value
    : null;
}

function restoreStorageValue(key: string, value: string | null): void {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // The pending draft remains available for explicit recovery if rollback is blocked.
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStoredUpdatedAt(raw: string | null): number {
  if (raw === null) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) && typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
      ? parsed.updatedAt
      : 0;
  } catch {
    return 0;
  }
}
