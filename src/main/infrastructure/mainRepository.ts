import { isfStore, type IsfStore } from '../../core/storage/IsfStore';
import {
  BrowserWorkspaceSaveLock,
  type WorkspaceSaveGuard,
  type WorkspaceSaveLeaseOptions,
  type WorkspaceSaveLock,
} from '../../workspace/infrastructure/workspaceSaveLock';
import type { MainData, SetupStep } from '../domain/model';
import { isMainDataShape, validateMainData, validateMainDraft } from '../domain/validation';

export { isMainDataShape } from '../domain/validation';

const MAIN_KEY = 'isf-main-v2';
const PENDING_KEY = 'isf-main-v2-pending';
const SETUP_PROGRESS_KEY = 'isf-main-v2-setup-progress';
const DISMISSED_RECOVERY_KEY = 'isf-main-v2-dismissed-recovery';
const QUARANTINED_CURRENT_KEY = 'isf-main-v2-quarantined-current';
const QUARANTINED_PENDING_KEY = 'isf-main-v2-quarantined-pending';
const setupSteps = new Set<SetupStep>(['welcome', 'income', 'housing', 'living', 'saving-investment', 'review']);
let lastIssuedUpdatedAt = 0;

export type MainLoadResult =
  | { status: 'empty'; data: null; original: null }
  | { status: 'current'; data: MainData; original: unknown }
  | {
    status: 'recovery';
    data: MainData;
    original: unknown;
    current: MainData | null;
    source: 'pending' | 'history';
  }
  | {
    status: 'failed';
    data: null;
    original: unknown;
    raw?: string;
    source?: 'current' | 'pending';
    reason: string;
  };

export interface MainRepository {
  load(): Promise<MainLoadResult>;
  save(data: MainData): Promise<MainData>;
  saveSetupProgress(step: SetupStep, draft: MainData, kind?: SetupProgressKind): void;
  loadSetupProgress(): SetupProgress | null;
  clearSetupProgress(): void;
  discardPending(expectedUpdatedAt?: number): void;
  discardRecovery(updatedAt: number): void;
  acknowledgeFailedCurrent(raw: string): void;
  acknowledgeFailedPending(raw: string): void;
}

export type SetupProgressKind = 'initial' | 'restart';

export interface SetupProgress {
  kind: SetupProgressKind;
  step: SetupStep;
  draft: MainData;
  savedAt: number;
}

export type MainHistoryStore = Pick<IsfStore, 'saveMainV2'> & Partial<Pick<IsfStore, 'loadLatestMainV2'>>;

export class BrowserMainRepository implements MainRepository {
  private readonly saveLock: WorkspaceSaveLock;
  private pendingWrittenByRepository: string | null = null;
  private malformedRecoverySources: Array<{ source: 'current' | 'pending'; raw: string }> = [];
  private readonly storageOverride?: Storage;

  constructor(
    private readonly historyStore: MainHistoryStore = isfStore,
    saveLock?: WorkspaceSaveLock,
    storage?: Storage,
    saveLeaseOptions: WorkspaceSaveLeaseOptions = {},
  ) {
    this.storageOverride = storage;
    this.saveLock = saveLock ?? new BrowserWorkspaceSaveLock(storage, saveLeaseOptions);
  }

  private get storage(): Storage {
    return this.storageOverride ?? window.localStorage;
  }

  async load(): Promise<MainLoadResult> {
    this.malformedRecoverySources = [];
    const storedCurrentRaw = this.storage.getItem(MAIN_KEY);
    const acknowledgedCurrentRaw = this.storage.getItem(QUARANTINED_CURRENT_KEY);
    const currentRaw = storedCurrentRaw === acknowledgedCurrentRaw ? null : storedCurrentRaw;
    const storedPendingRaw = this.storage.getItem(PENDING_KEY);
    const acknowledgedPendingRaw = this.storage.getItem(QUARANTINED_PENDING_KEY);
    const pendingRaw = storedPendingRaw === acknowledgedPendingRaw ? null : storedPendingRaw;
    const current = currentRaw === null ? null : parseStoredMain(currentRaw);
    const pending = pendingRaw === null ? null : parseStoredMain(pendingRaw);
    const history = await this.loadHistoryCandidate();
    const currentData = current?.data ?? null;
    const dismissedUpdatedAt = readDismissedRecoveryUpdatedAt(this.storage);
    let recoveryCandidate: {
      data: MainData;
      original: unknown;
      source: 'pending' | 'history';
    } | null = null;

    if (pending?.data != null
      && pending.data.updatedAt > dismissedUpdatedAt
      && (currentData === null || pending.data.updatedAt >= currentData.updatedAt)) {
      recoveryCandidate = {
        data: pending.data,
        original: pending.original,
        source: 'pending',
      };
    }

    if (history?.data != null
      && history.data.updatedAt > dismissedUpdatedAt
      && (currentData === null || history.data.updatedAt > currentData.updatedAt)
      && (recoveryCandidate === null || history.data.updatedAt > recoveryCandidate.data.updatedAt)) {
      recoveryCandidate = {
        data: history.data,
        original: history.original,
        source: 'history',
      };
    }

    if (recoveryCandidate !== null) {
      if (current?.status === 'failed' && current.raw !== undefined) {
        this.malformedRecoverySources.push({ source: 'current', raw: current.raw });
      }
      if (pending?.status === 'failed' && pending.raw !== undefined) {
        this.malformedRecoverySources.push({ source: 'pending', raw: pending.raw });
      }
      return {
        status: 'recovery',
        data: recoveryCandidate.data,
        original: recoveryCandidate.original,
        current: currentData,
        source: recoveryCandidate.source,
      };
    }

    if (current !== null) {
      return current.status === 'failed' ? { ...current, source: 'current' } : current;
    }
    if (pending?.status === 'failed') return { ...pending, source: 'pending' };
    return { status: 'empty', data: null, original: null };
  }

  async save(data: MainData): Promise<MainData> {
    if (!isMainDataShape(data)) {
      throw new Error('Cannot save invalid main data shape.');
    }
    const validation = validateMainData(data);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid main data: ${validation.issues.map((issue) => issue.code).join(', ')}`);
    }

    return this.saveLock.runExclusive((guard) => this.saveLocked(data, guard));
  }

  private async saveLocked(data: MainData, guard: WorkspaceSaveGuard): Promise<MainData> {
    guard.assertOwned();
    const historyUpdatedAt = await this.loadHistoryUpdatedAtForSave();
    guard.assertOwned();
    const next = cloneMainData(data);
    next.updatedAt = this.nextUpdatedAt(data.updatedAt, historyUpdatedAt);
    let previousCurrent: string | null = null;
    let currentWriteAttempted = false;
    let serialized = '';

    try {
      serialized = JSON.stringify(next);
      previousCurrent = this.storage.getItem(MAIN_KEY);
      guard.assertOwned();
      await this.historyStore.saveMainV2(next);
      guard.assertOwned();
      this.storage.setItem(PENDING_KEY, serialized);
      this.pendingWrittenByRepository = serialized;
      guard.assertOwned();
      currentWriteAttempted = true;
      this.storage.setItem(MAIN_KEY, serialized);
      if (this.removeIfOwnedAndEqual(guard, PENDING_KEY, serialized)) {
        this.pendingWrittenByRepository = null;
      }
      return next;
    } catch (error) {
      if (currentWriteAttempted && serialized !== '') {
        this.restoreIfTransactionCurrent(guard, MAIN_KEY, serialized, previousCurrent, serialized);
      }
      throw error;
    }
  }

  private removeIfOwnedAndEqual(guard: WorkspaceSaveGuard, key: string, expectedValue: string): boolean {
    guard.assertOwned();
    if (this.storage.getItem(key) !== expectedValue) return false;
    guard.assertOwned();
    if (this.storage.getItem(key) === expectedValue) {
      this.storage.removeItem(key);
      return true;
    }
    return false;
  }

  private restoreIfTransactionCurrent(
    guard: WorkspaceSaveGuard,
    key: string,
    expectedValue: string,
    previousValue: string | null,
    transactionCurrent: string,
  ): void {
    try {
      guard.assertOwned();
      if (this.storage.getItem(MAIN_KEY) !== transactionCurrent) return;
      if (this.storage.getItem(key) !== expectedValue) return;
      guard.assertOwned();
      if (this.storage.getItem(MAIN_KEY) !== transactionCurrent) return;
      if (this.storage.getItem(key) !== expectedValue) return;
      restoreStorageValue(this.storage, key, previousValue);
    } catch {
      // The pending draft remains available; a lost lease or newer revision must never be rolled back.
    }
  }

  saveSetupProgress(step: SetupStep, draft: MainData, kind: SetupProgressKind = 'initial'): void {
    this.storage.setItem(SETUP_PROGRESS_KEY, JSON.stringify({
      kind,
      step,
      draft: cloneMainData(draft),
      savedAt: Date.now(),
    }));
  }

  loadSetupProgress(): SetupProgress | null {
    const stored = this.storage.getItem(SETUP_PROGRESS_KEY);
    if (stored === null) return null;

    try {
      const parsed: unknown = JSON.parse(stored);
      if (!isSetupProgress(parsed)) return null;
      return {
        kind: parsed.kind === 'restart' ? 'restart' : 'initial',
        step: parsed.step,
        draft: cloneMainData(parsed.draft),
        savedAt: parsed.savedAt ?? parsed.draft.updatedAt,
      };
    } catch {
      return null;
    }
  }

  clearSetupProgress(): void {
    this.storage.removeItem(SETUP_PROGRESS_KEY);
  }

  discardPending(expectedUpdatedAt?: number): void {
    const pendingRaw = this.storage.getItem(PENDING_KEY);
    if (pendingRaw === null) return;
    const targetRaw = expectedUpdatedAt === undefined ? this.pendingWrittenByRepository : pendingRaw;
    if (targetRaw === null || pendingRaw !== targetRaw) return;
    const pendingUpdatedAt = readStoredUpdatedAt(targetRaw);
    if (expectedUpdatedAt !== undefined && pendingUpdatedAt !== expectedUpdatedAt) return;
    if (this.storage.getItem(PENDING_KEY) !== targetRaw) return;
    this.pendingWrittenByRepository = null;
    this.discardRecovery(pendingUpdatedAt);
  }

  discardRecovery(updatedAt: number): void {
    if (!Number.isSafeInteger(updatedAt) || updatedAt <= 0) return;
    for (const malformed of this.malformedRecoverySources) {
      if (malformed.source === 'current') {
        this.acknowledgeFailedCurrent(malformed.raw);
      } else {
        this.acknowledgeFailedPending(malformed.raw);
      }
    }
    this.malformedRecoverySources = [];
    const current = readDismissedRecoveryUpdatedAt(this.storage);
    this.storage.setItem(DISMISSED_RECOVERY_KEY, String(Math.max(current, updatedAt)));
  }

  acknowledgeFailedCurrent(raw: string): void {
    if (this.storage.getItem(MAIN_KEY) !== raw) return;
    this.storage.setItem(QUARANTINED_CURRENT_KEY, raw);
    if (this.storage.getItem(QUARANTINED_CURRENT_KEY) !== raw) {
      throw new Error('Could not quarantine malformed Main data.');
    }
  }

  acknowledgeFailedPending(raw: string): void {
    if (this.storage.getItem(PENDING_KEY) !== raw) return;
    this.storage.setItem(QUARANTINED_PENDING_KEY, raw);
    if (this.storage.getItem(QUARANTINED_PENDING_KEY) !== raw) {
      throw new Error('Could not quarantine malformed pending Main data.');
    }
  }

  private nextUpdatedAt(inputUpdatedAt: number, historyUpdatedAt: number): number {
    const persistedUpdatedAt = readStoredUpdatedAt(this.storage.getItem(MAIN_KEY));
    const pendingUpdatedAt = readStoredUpdatedAt(this.storage.getItem(PENDING_KEY));
    const dismissedUpdatedAt = readDismissedRecoveryUpdatedAt(this.storage);
    const clockUpdatedAt = Date.now();
    if (!isNonnegativeSafeInteger(clockUpdatedAt)) {
      throw new Error('Cannot issue a safe Main revision.');
    }

    const ceiling = Math.max(
      persistedUpdatedAt,
      pendingUpdatedAt,
      inputUpdatedAt,
      historyUpdatedAt,
      dismissedUpdatedAt,
      lastIssuedUpdatedAt,
    );
    if (!isNonnegativeSafeInteger(ceiling) || ceiling >= Number.MAX_SAFE_INTEGER) {
      throw new Error('Cannot issue a safe Main revision.');
    }

    const updatedAt = Math.max(
      clockUpdatedAt,
      ceiling + 1,
      lastIssuedUpdatedAt + 1,
    );
    if (!isNonnegativeSafeInteger(updatedAt)) {
      throw new Error('Cannot issue a safe Main revision.');
    }
    lastIssuedUpdatedAt = updatedAt;
    return updatedAt;
  }

  private async loadHistoryCandidate(): Promise<MainLoadResult | null> {
    if (this.historyStore.loadLatestMainV2 === undefined) return null;
    try {
      const latest = await this.historyStore.loadLatestMainV2();
      return latest === null ? null : parseMainValue(latest);
    } catch {
      return null;
    }
  }

  private async loadHistoryUpdatedAtForSave(): Promise<number> {
    if (this.historyStore.loadLatestMainV2 === undefined) return 0;
    const latest = await this.historyStore.loadLatestMainV2();
    if (latest === null) return 0;
    return parseMainValue(latest).data?.updatedAt ?? 0;
  }
}

function parseStoredMain(raw: string): MainLoadResult {
  try {
    return parseMainValue(JSON.parse(raw), raw);
  } catch {
    return {
      status: 'failed',
      data: null,
      original: raw,
      raw,
      reason: 'Stored main data is not valid JSON.',
    };
  }
}

function parseMainValue(value: unknown, raw?: string): MainLoadResult {
  if (!isMainDataShape(value)) {
    return {
      status: 'failed',
      data: null,
      original: value,
      ...(raw === undefined ? {} : { raw }),
      reason: 'Stored main data has an unsupported schema.',
    };
  }

  const data = cloneMainData(value);
  const validation = validateMainData(data);
  return validation.valid
    ? { status: 'current', data, original: value }
    : {
      status: 'failed',
      data: null,
      original: value,
      ...(raw === undefined ? {} : { raw }),
      reason: validationReason(validation.issues),
    };
}

function isSetupProgress(value: unknown): value is {
  kind?: SetupProgressKind;
  step: SetupStep;
  draft: MainData;
  savedAt?: number;
} {
  if (!isRecord(value) || typeof value.step !== 'string' || !setupSteps.has(value.step as SetupStep)) return false;
  if (value.kind !== undefined && value.kind !== 'initial' && value.kind !== 'restart') return false;
  if (value.savedAt !== undefined && !isNonnegativeSafeInteger(value.savedAt)) return false;
  return isMainDataShape(value.draft) && validateMainDraft(value.draft).valid;
}

function cloneMainData(data: MainData): MainData {
  return { ...data };
}

function validationReason(issues: { path: string; code: string }[]): string {
  return `Main data validation failed: ${issues.map((issue) => `${issue.path}:${issue.code}`).join(', ')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function readStoredUpdatedAt(raw: string | null): number {
  if (raw === null) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) && isNonnegativeSafeInteger(parsed.updatedAt) ? parsed.updatedAt : 0;
  } catch {
    return 0;
  }
}

function restoreStorageValue(storage: Storage, key: string, value: string | null): void {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
}

function readDismissedRecoveryUpdatedAt(storage: Storage): number {
  const parsed = Number(storage.getItem(DISMISSED_RECOVERY_KEY));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}
