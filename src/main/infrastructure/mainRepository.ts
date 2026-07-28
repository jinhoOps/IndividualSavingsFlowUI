import { isfStore, type IsfStore } from '../../core/storage/IsfStore';
import type { MainData, SetupStep } from '../domain/model';
import { validateMainData } from '../domain/validation';
import { isMainDataShape, migrateLegacyMain, type MigrationResult } from './legacyMigration';

const MAIN_KEY = 'isf-main-v1';
const PENDING_KEY = 'isf-main-v1-pending';
const LEGACY_KEY = 'isf-rebuild-v1';
const SETUP_PROGRESS_KEY = 'isf-main-v1-setup-progress';

const setupSteps = new Set<SetupStep>(['welcome', 'income', 'expense', 'saving-investment', 'account', 'review']);

export interface MainRepository {
  load(): Promise<MigrationResult>;
  save(data: MainData): Promise<void>;
  saveSetupProgress(step: SetupStep, draft: MainData): void;
  loadSetupProgress(): { step: SetupStep; draft: MainData } | null;
  clearSetupProgress(): void;
}

export type MainHistoryStore = Pick<IsfStore, 'saveMainV1'>;

export class BrowserMainRepository implements MainRepository {
  constructor(private readonly historyStore: MainHistoryStore = isfStore) {}

  async load(): Promise<MigrationResult> {
    const current = window.localStorage.getItem(MAIN_KEY);
    if (current !== null) return migrateStored(current);

    const pending = window.localStorage.getItem(PENDING_KEY);
    if (pending !== null) return migrateStored(pending);

    const legacy = window.localStorage.getItem(LEGACY_KEY);
    return legacy === null ? migrateLegacyMain(null) : migrateStored(legacy);
  }

  async save(data: MainData): Promise<void> {
    const validation = validateMainData(data);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid main data: ${validation.issues.map((issue) => issue.code).join(', ')}`);
    }

    const next = cloneMainData(data);
    next.updatedAt = Date.now();
    const serialized = JSON.stringify(next);

    await this.historyStore.saveMainV1(next);
    window.localStorage.setItem(PENDING_KEY, serialized);
    window.localStorage.setItem(MAIN_KEY, serialized);
    window.localStorage.removeItem(PENDING_KEY);
  }

  saveSetupProgress(step: SetupStep, draft: MainData): void {
    window.localStorage.setItem(SETUP_PROGRESS_KEY, JSON.stringify({ step, draft: cloneMainData(draft) }));
  }

  loadSetupProgress(): { step: SetupStep; draft: MainData } | null {
    const stored = window.localStorage.getItem(SETUP_PROGRESS_KEY);
    if (stored === null) return null;

    try {
      const parsed: unknown = JSON.parse(stored);
      if (!isSetupProgress(parsed)) return null;
      return { step: parsed.step, draft: cloneMainData(parsed.draft) };
    } catch {
      return null;
    }
  }

  clearSetupProgress(): void {
    window.localStorage.removeItem(SETUP_PROGRESS_KEY);
  }
}

function migrateStored(raw: string): MigrationResult {
  try {
    return migrateLegacyMain(JSON.parse(raw));
  } catch {
    return { status: 'failed', data: null, original: raw, reason: 'Stored main data is not valid JSON.' };
  }
}

function isSetupProgress(value: unknown): value is { step: SetupStep; draft: MainData } {
  if (!isRecord(value) || typeof value.step !== 'string' || !setupSteps.has(value.step as SetupStep)) return false;
  return isMainDataShape(value.draft);
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
