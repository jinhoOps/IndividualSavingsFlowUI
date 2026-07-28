import { isfStore, type IsfStore } from '../../core/storage/IsfStore';
import type { MainData, SetupStep } from '../domain/model';
import { validateMainData } from '../domain/validation';
import {
  isMainDataShape,
  migrateLegacyMain,
  normalizeLegacyMainRecord,
  type MigrationResult,
} from './legacyMigration';

const MAIN_KEY = 'isf-main-v1';
const PENDING_KEY = 'isf-main-v1-pending';
const LEGACY_KEY = 'isf-rebuild-v1';
const LEGACY_ACTIVE_KEY = 'isf-step1-active';
const SETUP_PROGRESS_KEY = 'isf-main-v1-setup-progress';
const DISMISSED_RECOVERY_KEY = 'isf-main-v1-dismissed-recovery';
const MAIN_SAVE_LOCK_NAME = 'isf-main-v1-save';
const MAIN_SAVE_LEASE_PREFIX = 'isf-main-v1-save-lease:';
const DEFAULT_LEASE_DURATION_MS = 10_000;
const DEFAULT_ACQUIRE_TIMEOUT_MS = 2_000;
const DEFAULT_RETRY_DELAY_MS = 25;

const setupSteps = new Set<SetupStep>(['welcome', 'income', 'expense', 'saving-investment', 'account', 'review']);
let lastIssuedUpdatedAt = 0;

export interface MainRepository {
  load(): Promise<MigrationResult>;
  save(data: MainData): Promise<MainData>;
  saveSetupProgress(step: SetupStep, draft: MainData, kind?: SetupProgressKind): void;
  loadSetupProgress(): SetupProgress | null;
  clearSetupProgress(): void;
  discardPending(expectedUpdatedAt?: number): void;
  discardRecovery(updatedAt: number): void;
}

export type SetupProgressKind = 'initial' | 'restart';

export interface SetupProgress {
  kind: SetupProgressKind;
  step: SetupStep;
  draft: MainData;
}

export type MainHistoryStore = Pick<IsfStore, 'saveMainV1'> & Partial<Pick<IsfStore, 'loadLatestMainV1'>>;

export interface MainSaveGuard {
  assertOwned(): void;
}

export interface MainSaveLock {
  runExclusive<T>(task: (guard: MainSaveGuard) => Promise<T>): Promise<T>;
}

export interface MainSaveLeaseOptions {
  createOwnerToken?: () => string;
  now?: () => number;
  wait?: (delayMs: number) => Promise<void>;
  yieldAfterSnapshot?: () => Promise<void>;
  yieldAfterClaim?: () => Promise<void>;
  leaseDurationMs?: number;
  acquireTimeoutMs?: number;
  retryDelayMs?: number;
}

interface MainSaveLease {
  owner: string;
  choosing: boolean;
  ticket: number;
  expiresAt: number;
}

export class BrowserMainSaveLock implements MainSaveLock {
  private readonly createOwnerToken: () => string;
  private readonly now: () => number;
  private readonly wait: (delayMs: number) => Promise<void>;
  private readonly yieldAfterSnapshot: () => Promise<void>;
  private readonly yieldAfterClaim: () => Promise<void>;
  private readonly leaseDurationMs: number;
  private readonly acquireTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly owner: string;
  private localTail = Promise.resolve();

  constructor(
    private readonly storageOverride?: Storage,
    options: MainSaveLeaseOptions = {},
  ) {
    this.createOwnerToken = options.createOwnerToken ?? createLeaseOwnerToken;
    this.now = options.now ?? Date.now;
    this.wait = options.wait ?? waitFor;
    this.yieldAfterSnapshot = options.yieldAfterSnapshot ?? (() => Promise.resolve());
    this.yieldAfterClaim = options.yieldAfterClaim ?? (() => waitFor(0));
    this.leaseDurationMs = positiveDuration(options.leaseDurationMs, DEFAULT_LEASE_DURATION_MS);
    this.acquireTimeoutMs = positiveDuration(options.acquireTimeoutMs, DEFAULT_ACQUIRE_TIMEOUT_MS);
    this.retryDelayMs = positiveDuration(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS);
    this.owner = this.createOwnerToken();
  }

  private get storage(): Storage {
    return this.storageOverride ?? window.localStorage;
  }

  async runExclusive<T>(task: (guard: MainSaveGuard) => Promise<T>): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.locks !== undefined) {
      return await navigator.locks.request(MAIN_SAVE_LOCK_NAME, () => task({ assertOwned: () => undefined }));
    }

    const result = this.localTail.then(
      () => this.runFallbackExclusive(task),
      () => this.runFallbackExclusive(task),
    );
    this.localTail = result.then(() => undefined, () => undefined);
    return await result;
  }

  private async runFallbackExclusive<T>(task: (guard: MainSaveGuard) => Promise<T>): Promise<T> {
    const key = mainSaveLeaseKey(this.owner);
    const ticket = await this.acquireBakeryTurn(this.owner, key);
    const guard = { assertOwned: () => this.renewAndAssertOwned(this.owner, key, ticket) };
    try {
      guard.assertOwned();
      return await task(guard);
    } finally {
      this.releaseIfOwned(this.owner, key, ticket);
    }
  }

  private async acquireBakeryTurn(owner: string, key: string): Promise<number> {
    try {
      const startedAt = this.now();
      const deadline = startedAt + this.acquireTimeoutMs;
      const maxAttempts = Math.max(1, Math.ceil(this.acquireTimeoutMs / this.retryDelayMs) + 1);
      const choosing = {
        owner,
        choosing: true,
        ticket: 0,
        expiresAt: startedAt + this.leaseDurationMs,
      };
      this.writeAndConfirmLease(key, choosing);
      const snapshot = this.readActiveLeases(startedAt);
      await this.yieldAfterSnapshot();
      const highestTicket = snapshot.reduce((highest, contender) => (
        contender.ticket > highest ? contender.ticket : highest
      ), 0);
      if (highestTicket >= Number.MAX_SAFE_INTEGER) {
        throw new Error('Could not acquire the Main save lock.');
      }

      const ticket = highestTicket + 1;
      this.writeAndConfirmLease(key, {
        owner,
        choosing: false,
        ticket,
        expiresAt: this.now() + this.leaseDurationMs,
      });
      await this.yieldAfterClaim();

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const now = this.now();
        this.renewAndAssertOwned(owner, key, ticket);
        if (this.hasBakeryTurn(owner, key, ticket, now)) return ticket;

        const remainingMs = deadline - now;
        if (remainingMs <= 0 || attempt === maxAttempts - 1) break;
        await this.wait(Math.min(this.retryDelayMs, remainingMs));
      }

      throw new Error('Could not acquire the Main save lock.');
    } catch (error) {
      this.abandonIfOwned(owner, key);
      throw error;
    }
  }

  private hasBakeryTurn(owner: string, key: string, ticket: number, now: number): boolean {
    return !this.readActiveLeases(now).some((contender) => {
      if (mainSaveLeaseKey(contender.owner) === key) return false;
      if (contender.choosing) return true;
      return contender.ticket < ticket
        || (contender.ticket === ticket && contender.owner < owner);
    });
  }

  private readActiveLeases(now: number): MainSaveLease[] {
    const leases: MainSaveLease[] = [];
    const length = this.storage.length;
    for (let index = 0; index < length; index += 1) {
      const key = this.storage.key(index);
      if (key === null || !key.startsWith(MAIN_SAVE_LEASE_PREFIX)) continue;
      const lease = readMainSaveLease(this.storage.getItem(key));
      if (lease === null
        || key !== mainSaveLeaseKey(lease.owner)
        || lease.expiresAt <= now
        || (!lease.choosing && lease.ticket === 0)) {
        continue;
      }
      leases.push(lease);
    }
    return leases;
  }

  private renewAndAssertOwned(owner: string, key: string, ticket: number): void {
    const now = this.now();
    const current = readMainSaveLease(this.storage.getItem(key));
    if (current?.owner !== owner
      || current.choosing
      || current.ticket !== ticket
      || current.expiresAt <= now) {
      throw new Error('Main save lock ownership was lost.');
    }

    this.writeAndConfirmLease(key, {
      owner,
      choosing: false,
      ticket,
      expiresAt: now + this.leaseDurationMs,
    });
  }

  private writeAndConfirmLease(key: string, lease: MainSaveLease): void {
    const serialized = JSON.stringify(lease);
    this.storage.setItem(key, serialized);
    if (this.storage.getItem(key) !== serialized) {
      throw new Error('Main save lock ownership was lost.');
    }
  }

  private abandonIfOwned(owner: string, key: string): void {
    try {
      const currentRaw = this.storage.getItem(key);
      const current = readMainSaveLease(currentRaw);
      if (current?.owner === owner && this.storage.getItem(key) === currentRaw) {
        this.storage.setItem(key, inactiveMainSaveLease(owner));
      }
    } catch {
      // An abandoned contender expires and is ignored by other tabs.
    }
  }

  private releaseIfOwned(owner: string, key: string, ticket: number): void {
    try {
      const currentRaw = this.storage.getItem(key);
      const current = readMainSaveLease(currentRaw);
      if (current?.owner === owner
        && !current.choosing
        && current.ticket === ticket
        && current.expiresAt > this.now()
        && this.storage.getItem(key) === currentRaw) {
        this.storage.setItem(key, inactiveMainSaveLease(owner));
      }
    } catch {
      // An unreleased lease expires, allowing another tab to recover after a crash or storage failure.
    }
  }
}

export class BrowserMainRepository implements MainRepository {
  private readonly saveLock: MainSaveLock;
  private pendingWrittenByRepository: string | null = null;
  private readonly storageOverride?: Storage;

  constructor(
    private readonly historyStore: MainHistoryStore = isfStore,
    saveLock?: MainSaveLock,
    storage?: Storage,
    saveLeaseOptions: MainSaveLeaseOptions = {},
  ) {
    this.storageOverride = storage;
    this.saveLock = saveLock ?? new BrowserMainSaveLock(storage, saveLeaseOptions);
  }

  private get storage(): Storage {
    return this.storageOverride ?? window.localStorage;
  }

  async load(): Promise<MigrationResult> {
    const currentRaw = this.storage.getItem(MAIN_KEY);
    const pendingRaw = this.storage.getItem(PENDING_KEY);
    const current = currentRaw === null ? null : migrateStored(currentRaw);
    const pending = pendingRaw === null ? null : migrateStored(pendingRaw);
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
      return {
        status: 'recovery',
        data: recoveryCandidate.data,
        original: recoveryCandidate.original,
        current: currentData,
        source: recoveryCandidate.source,
      };
    }

    if (currentData !== null && current !== null) return current;
    if (current !== null) return current;
    if (pending !== null && pending.data === null) return pending;

    const legacy = this.storage.getItem(LEGACY_KEY);
    return legacy === null ? migrateLegacyMain(null) : migrateStored(legacy);
  }

  async save(data: MainData): Promise<MainData> {
    const validation = validateMainData(data);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid main data: ${validation.issues.map((issue) => issue.code).join(', ')}`);
    }

    return this.saveLock.runExclusive((guard) => this.saveLocked(data, guard));
  }

  private async saveLocked(data: MainData, guard: MainSaveGuard): Promise<MainData> {
    const next = cloneMainData(data);
    next.updatedAt = this.nextUpdatedAt();
    let previousCurrent: string | null = null;
    let previousLegacy: string | null = null;
    let previousLegacyActive: string | null = null;
    let currentWriteAttempted = false;
    let legacyWriteAttempted = false;
    let legacyActiveWriteAttempted = false;
    let serialized = '';
    let compatibility = '';

    try {
      serialized = JSON.stringify(next);
      previousCurrent = this.storage.getItem(MAIN_KEY);
      previousLegacy = this.storage.getItem(LEGACY_KEY);
      previousLegacyActive = this.storage.getItem(LEGACY_ACTIVE_KEY);
      compatibility = JSON.stringify(createLegacyProjection(
        next,
        previousLegacy,
      ));
      guard.assertOwned();
      await this.historyStore.saveMainV1(next);
      guard.assertOwned();
      this.storage.setItem(PENDING_KEY, serialized);
      this.pendingWrittenByRepository = serialized;
      guard.assertOwned();
      currentWriteAttempted = true;
      this.storage.setItem(MAIN_KEY, serialized);
      guard.assertOwned();
      legacyWriteAttempted = true;
      this.storage.setItem(LEGACY_KEY, compatibility);
      guard.assertOwned();
      legacyActiveWriteAttempted = true;
      this.storage.setItem(LEGACY_ACTIVE_KEY, compatibility);
      if (this.removeIfOwnedAndEqual(guard, PENDING_KEY, serialized)) {
        this.pendingWrittenByRepository = null;
      }
      return next;
    } catch (error) {
      if (currentWriteAttempted && serialized !== '') {
        if (legacyActiveWriteAttempted) {
          this.restoreIfTransactionCurrent(
            guard,
            LEGACY_ACTIVE_KEY,
            compatibility,
            previousLegacyActive,
            serialized,
          );
        }
        if (legacyWriteAttempted) {
          this.restoreIfTransactionCurrent(guard, LEGACY_KEY, compatibility, previousLegacy, serialized);
        }
        this.restoreIfTransactionCurrent(guard, MAIN_KEY, serialized, previousCurrent, serialized);
      }
      throw error;
    }
  }

  private removeIfOwnedAndEqual(guard: MainSaveGuard, key: string, expectedValue: string): boolean {
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
    guard: MainSaveGuard,
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
    this.storage.setItem(SETUP_PROGRESS_KEY, JSON.stringify({ kind, step, draft: cloneMainData(draft) }));
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
    this.storage.removeItem(PENDING_KEY);
    this.pendingWrittenByRepository = null;
    this.discardRecovery(pendingUpdatedAt);
  }

  discardRecovery(updatedAt: number): void {
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return;
    const current = readDismissedRecoveryUpdatedAt(this.storage);
    this.storage.setItem(DISMISSED_RECOVERY_KEY, String(Math.max(current, updatedAt)));
  }

  private nextUpdatedAt(): number {
    const persistedUpdatedAt = readStoredUpdatedAt(this.storage.getItem(MAIN_KEY));
    const pendingUpdatedAt = readStoredUpdatedAt(this.storage.getItem(PENDING_KEY));
    if (persistedUpdatedAt === 0 && pendingUpdatedAt === 0) {
      lastIssuedUpdatedAt = 0;
    }
    const updatedAt = Math.max(
      Date.now(),
      persistedUpdatedAt + 1,
      pendingUpdatedAt + 1,
      lastIssuedUpdatedAt + 1,
    );
    lastIssuedUpdatedAt = updatedAt;
    return updatedAt;
  }

  private async loadHistoryCandidate(): Promise<MigrationResult | null> {
    if (this.historyStore.loadLatestMainV1 === undefined) return null;
    try {
      const latest = await this.historyStore.loadLatestMainV1();
      return latest === null ? null : migrateLegacyMain(latest);
    } catch {
      return null;
    }
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
  const previous = normalizeLegacyMainRecord(parseRecord(previousRaw));
  const accounts = mergeRecordsById(previous.accounts, data.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.kind,
  })));
  const incomeItems = mergeRecordsById(previous.incomes, data.incomes.map((income) => {
    const previousIncome = findRecordById(previous.incomes, income.id);
    return {
      id: income.id,
      name: income.name,
      amount: income.amountWon,
      group: income.group,
      accountId: income.accountId,
      allocations: mergeRecordsByKey(
        previousIncome?.allocations,
        income.allocations.map((allocation) => ({
          accountId: allocation.accountId,
          amount: allocation.amountWon,
        })),
        'accountId',
      ),
    };
  }));
  const expenseItems = projectFinancialItems(data.expenses, previous.expenseItems);
  const savingsItems = projectFinancialItems(data.savings, previous.savingsItems);
  const investItems = projectFinancialItems(data.investments, previous.investItems);
  const accountIds = new Set(data.accounts.map((account) => account.id));
  const transfers = preserveTransfers(previous.transfers, accountIds);
  const ownerIds = createLegacyOwnerIds(data, transfers);
  const previousAccountIds = recordIds(previous.accounts);
  const relationships = preserveRelationships(previous.relationships, ownerIds, accountIds, previousAccountIds);

  return {
    ...previous,
    modelVersion: 10,
    version: 2,
    updatedAt: data.updatedAt,
    incomes: incomeItems,
    expenseItems,
    savingsItems,
    investItems,
    accounts,
    transfers,
    relationships,
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

function projectFinancialItems(
  items: MainData['expenses'],
  previousItems: unknown,
): Array<Record<string, unknown>> {
  return mergeRecordsById(previousItems, items.map((item) => ({
    id: item.id,
    name: item.name,
    amount: item.amountWon,
    group: item.group,
    accountId: item.accountId,
    annualRate: item.annualRate,
    maturityMonth: item.maturityMonth,
  })));
}

function mergeRecordsById(previousItems: unknown, nextItems: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return mergeRecordsByKey(previousItems, nextItems, 'id');
}

function mergeRecordsByKey(
  previousItems: unknown,
  nextItems: Array<Record<string, unknown>>,
  key: string,
): Array<Record<string, unknown>> {
  const previousByKey = new Map<string, Record<string, unknown>>();
  if (Array.isArray(previousItems)) {
    previousItems.forEach((item) => {
      if (!isRecord(item) || typeof item[key] !== 'string') return;
      previousByKey.set(item[key], item);
    });
  }

  return nextItems.map((item) => {
    const value = item[key];
    const previous = typeof value === 'string' ? previousByKey.get(value) : undefined;
    return previous === undefined ? item : { ...previous, ...item };
  });
}

function findRecordById(value: unknown, id: string): Record<string, unknown> | null {
  if (!Array.isArray(value)) return null;
  return value.find((item): item is Record<string, unknown> => isRecord(item) && item.id === id) ?? null;
}

function recordIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(value.flatMap((item) => (
    isRecord(item) && typeof item.id === 'string' ? [item.id] : []
  )));
}

function preserveTransfers(value: unknown, accountIds: Set<string>): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((transfer): transfer is Record<string, unknown> => (
    isRecord(transfer)
    && typeof transfer.id === 'string'
    && typeof transfer.sourceAccountId === 'string'
    && typeof transfer.targetAccountId === 'string'
    && transfer.sourceAccountId !== transfer.targetAccountId
    && accountIds.has(transfer.sourceAccountId)
    && accountIds.has(transfer.targetAccountId)
  )).map((transfer) => ({ ...transfer }));
}

function createLegacyOwnerIds(
  data: MainData,
  transfers: Array<Record<string, unknown>>,
): Map<string, Set<string>> {
  return new Map([
    ['accounts', new Set(data.accounts.map((item) => item.id))],
    ['incomes', new Set(data.incomes.map((item) => item.id))],
    ['expenseItems', new Set(data.expenses.map((item) => item.id))],
    ['expenses', new Set(data.expenses.map((item) => item.id))],
    ['savingsItems', new Set(data.savings.map((item) => item.id))],
    ['savings', new Set(data.savings.map((item) => item.id))],
    ['investItems', new Set(data.investments.map((item) => item.id))],
    ['investments', new Set(data.investments.map((item) => item.id))],
    ['transfers', new Set(transfers.flatMap((item) => typeof item.id === 'string' ? [item.id] : []))],
  ]);
}

function preserveRelationships(
  value: unknown,
  ownerIds: Map<string, Set<string>>,
  accountIds: Set<string>,
  previousAccountIds: Set<string>,
): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((relationship): relationship is Record<string, unknown> => {
    if (!isRecord(relationship) || typeof relationship.id !== 'string') return false;
    const sourceRef = relationship.sourceRef;
    if (isRecord(sourceRef) && typeof sourceRef.collection === 'string' && typeof sourceRef.id === 'string') {
      return ownerIds.get(sourceRef.collection)?.has(sourceRef.id) === true;
    }

    const referencedAccounts = [relationship.accountId, relationship.sourceAccountId, relationship.targetAccountId]
      .filter((id): id is string => typeof id === 'string' && previousAccountIds.has(id));
    return referencedAccounts.length > 0 && referencedAccounts.every((id) => accountIds.has(id));
  }).map((relationship) => ({ ...relationship }));
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

function restoreStorageValue(storage: Storage, key: string, value: string | null): void {
  try {
    if (value === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, value);
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

function readMainSaveLease(raw: string | null): MainSaveLease | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed)
      && typeof parsed.owner === 'string'
      && parsed.owner !== ''
      && typeof parsed.choosing === 'boolean'
      && typeof parsed.ticket === 'number'
      && Number.isSafeInteger(parsed.ticket)
      && parsed.ticket >= 0
      && typeof parsed.expiresAt === 'number'
      && Number.isFinite(parsed.expiresAt)
      ? {
          owner: parsed.owner,
          choosing: parsed.choosing,
          ticket: parsed.ticket,
          expiresAt: parsed.expiresAt,
        }
      : null;
  } catch {
    return null;
  }
}

function mainSaveLeaseKey(owner: string): string {
  return `${MAIN_SAVE_LEASE_PREFIX}${encodeURIComponent(owner)}`;
}

function inactiveMainSaveLease(owner: string): string {
  return JSON.stringify({
    owner,
    choosing: false,
    ticket: 0,
    expiresAt: 0,
  } satisfies MainSaveLease);
}

function createLeaseOwnerToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function waitFor(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function positiveDuration(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function readDismissedRecoveryUpdatedAt(storage: Storage): number {
  const parsed = Number(storage.getItem(DISMISSED_RECOVERY_KEY));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
