import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BrowserMainRepository,
  BrowserMainSaveLock,
} from '../../../src/main/infrastructure/mainRepository';
import type { MainData } from '../../../src/main/domain/model';

class MemoryStorage implements Storage {
  constructor(protected readonly values = new Map<string, string>()) {}

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class HookedStorage extends MemoryStorage {
  constructor(
    values: Map<string, string>,
    private readonly setHook: (key: string, value: string, commit: () => void) => void,
    private readonly getHook?: (key: string, read: () => string | null) => string | null,
    private readonly removeHook?: (key: string, remove: () => void) => void,
  ) {
    super(values);
  }

  override getItem(key: string): string | null {
    return this.getHook?.(key, () => super.getItem(key)) ?? super.getItem(key);
  }

  override setItem(key: string, value: string): void {
    this.setHook(key, value, () => super.setItem(key, value));
  }

  override removeItem(key: string): void {
    if (this.removeHook === undefined) {
      super.removeItem(key);
      return;
    }
    this.removeHook(key, () => super.removeItem(key));
  }
}

const validData = (): MainData => ({
  schemaVersion: 1,
  updatedAt: 0,
  incomes: [{
    id: 'income-main',
    name: '급여',
    amountWon: 4_200_000,
    accountId: 'acc-salary',
    allocations: [{ accountId: 'acc-salary', amountWon: 4_200_000 }],
  }],
  expenses: [],
  savings: [],
  investments: [],
  accounts: [{ id: 'acc-salary', name: '급여통장', kind: 'income' }],
});

describe('BrowserMainSaveLock', () => {
  it('does not let a contender paused after a free snapshot overwrite an owner already inside', async () => {
    const sharedValues = new Map<string, string>();
    let releaseFirstSnapshot: (() => void) | undefined;
    let markFirstSnapshot: (() => void) | undefined;
    const firstSnapshot = new Promise<void>((resolve) => {
      markFirstSnapshot = resolve;
    });
    const snapshotGate = new Promise<void>((resolve) => {
      releaseFirstSnapshot = resolve;
    });
    const releases = new Map<string, () => void>();
    const releasePromises = new Map<string, Promise<void>>();
    for (const owner of ['tab-a', 'tab-b']) {
      releasePromises.set(owner, new Promise<void>((resolve) => {
        releases.set(owner, resolve);
      }));
    }
    const active = new Set<string>();
    const entered: string[] = [];
    let maxActive = 0;
    const task = (owner: string) => async () => {
      active.add(owner);
      entered.push(owner);
      maxActive = Math.max(maxActive, active.size);
      await releasePromises.get(owner);
      active.delete(owner);
    };
    const commonOptions = {
      now: () => 1_000,
      wait: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
      yieldAfterClaim: async () => undefined,
      leaseDurationMs: 100,
      acquireTimeoutMs: 500,
      retryDelayMs: 10,
    };
    const firstLock = new BrowserMainSaveLock(new MemoryStorage(sharedValues), {
      ...commonOptions,
      createOwnerToken: () => 'tab-a',
      yieldAfterSnapshot: async () => {
        markFirstSnapshot?.();
        await snapshotGate;
      },
    });
    const secondLock = new BrowserMainSaveLock(new MemoryStorage(sharedValues), {
      ...commonOptions,
      createOwnerToken: () => 'tab-b',
    });

    const firstRun = firstLock.runExclusive(task('tab-a'));
    await firstSnapshot;
    const secondRun = secondLock.runExclusive(task('tab-b'));
    await Promise.resolve();
    await Promise.resolve();
    releaseFirstSnapshot?.();
    await vi.waitFor(() => expect(entered.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    releases.get('tab-a')?.();
    releases.get('tab-b')?.();
    await Promise.all([firstRun, secondRun]);

    expect(entered).toHaveLength(2);
    expect(maxActive).toBe(1);
  });

  it('orders contenders that select the same bakery ticket without overlapping', async () => {
    const sharedValues = new Map<string, string>();
    const entered: string[] = [];
    const snapshotWaiters: Array<{ owner: string; resolve: () => void }> = [];
    let releaseFirstTask: (() => void) | undefined;
    const firstTaskGate = new Promise<void>((resolve) => {
      releaseFirstTask = resolve;
    });
    const options = (owner: string) => ({
      createOwnerToken: () => owner,
      now: () => 1_000,
      wait: () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
      yieldAfterSnapshot: () => new Promise<void>((resolve) => snapshotWaiters.push({ owner, resolve })),
      yieldAfterClaim: async () => undefined,
      leaseDurationMs: 100,
      acquireTimeoutMs: 500,
      retryDelayMs: 10,
    });
    const firstLock = new BrowserMainSaveLock(new MemoryStorage(sharedValues), options('tab-a'));
    const secondLock = new BrowserMainSaveLock(new MemoryStorage(sharedValues), options('tab-b'));

    const firstRun = firstLock.runExclusive(async () => {
      entered.push('tab-a');
      await firstTaskGate;
    });
    await vi.waitFor(() => expect(snapshotWaiters).toHaveLength(1));
    const secondRun = secondLock.runExclusive(async () => {
      entered.push('tab-b');
    });
    await vi.waitFor(() => expect(snapshotWaiters).toHaveLength(2));
    releaseClaim(snapshotWaiters, 'tab-b');
    releaseClaim(snapshotWaiters, 'tab-a');
    await vi.waitFor(() => expect(entered).toEqual(['tab-a']));

    expect(entered).toEqual(['tab-a']);
    releaseFirstTask?.();
    await Promise.all([firstRun, secondRun]);
    expect(entered).toEqual(['tab-a', 'tab-b']);
  });

  it('does not remove a successor lease installed after the former owner final read', async () => {
    const sharedValues = new Map<string, string>();
    const firstKey = leaseStorageKey('tab-a');
    const successorRaw = activeLeaseRecord('tab-b', 2_000, 2);
    let replaceLeaseOnRelease = false;
    const storage = new HookedStorage(
      sharedValues,
      (_key, _value, commit) => commit(),
      (key, read) => {
        const current = read();
        if (key === firstKey && replaceLeaseOnRelease) {
          replaceLeaseOnRelease = false;
          sharedValues.set(key, successorRaw);
        }
        return current;
      },
    );
    const clock = createControlledLeaseClock(1_000);
    const lock = new BrowserMainSaveLock(storage, leaseOptions('tab-a', clock));

    await lock.runExclusive(async () => {
      replaceLeaseOnRelease = true;
    });

    expect(storage.getItem(firstKey)).toBe(successorRaw);
  });
});

describe('BrowserMainRepository', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and migrates isf-rebuild-v1 when no current main data exists', async () => {
    window.localStorage.setItem('isf-rebuild-v1', JSON.stringify({
      modelVersion: 10,
      incomes: [{
        id: 'income-main', name: '급여', amount: 4_200_000,
        allocations: [{ accountId: 'acc-salary', amount: 4_200_000 }],
      }],
      expenseItems: [], savingsItems: [], investItems: [],
      accounts: [
        { id: 'acc-salary', name: '급여통장', type: 'income' },
        { id: 'acc-living', name: '생활비통장', type: 'spending' },
      ],
    }));

    const result = await new BrowserMainRepository({ saveMainV1: vi.fn() }).load();

    expect(result.status).toBe('migrated');
    expect(result.data?.incomes[0].amountWon).toBe(4_200_000);
  });

  it('offers a newer validated history revision for explicit recovery without auto-applying it', async () => {
    const current = validData();
    current.updatedAt = 10;
    const history = validData();
    history.updatedAt = 20;
    history.incomes[0].amountWon = 5_000_000;
    history.incomes[0].allocations[0].amountWon = 5_000_000;
    window.localStorage.setItem('isf-main-v1', JSON.stringify(current));
    const repository = new BrowserMainRepository({
      saveMainV1: vi.fn(),
      loadLatestMainV1: vi.fn().mockResolvedValue(history),
    });

    const result = await repository.load();

    expect(result).toMatchObject({
      status: 'recovery',
      source: 'history',
      current: { updatedAt: 10 },
      data: { updatedAt: 20, incomes: [{ amountWon: 5_000_000 }] },
    });
    expect(JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '')).toEqual(current);
  });

  it('durably suppresses a discarded history revision across repository reloads', async () => {
    const current = validData();
    current.updatedAt = 10;
    const history = validData();
    history.updatedAt = 20;
    window.localStorage.setItem('isf-main-v1', JSON.stringify(current));
    const repository = new BrowserMainRepository({
      saveMainV1: vi.fn(),
      loadLatestMainV1: vi.fn().mockResolvedValue(history),
    });
    expect(await repository.load()).toMatchObject({ status: 'recovery', source: 'history' });

    repository.discardRecovery(history.updatedAt);

    expect(await repository.load()).toMatchObject({ status: 'current', data: { updatedAt: 10 } });
    expect(window.localStorage.getItem('isf-main-v1-dismissed-recovery')).toBe('20');
  });

  it('offers newer validated history instead of masking it with an older pending draft', async () => {
    const current = validData();
    current.updatedAt = 10;
    const pending = validData();
    pending.updatedAt = 20;
    pending.incomes[0].amountWon = 5_000_000;
    pending.incomes[0].allocations[0].amountWon = 5_000_000;
    const history = validData();
    history.updatedAt = 30;
    history.incomes[0].amountWon = 6_000_000;
    history.incomes[0].allocations[0].amountWon = 6_000_000;
    window.localStorage.setItem('isf-main-v1', JSON.stringify(current));
    window.localStorage.setItem('isf-main-v1-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({
      saveMainV1: vi.fn(),
      loadLatestMainV1: vi.fn().mockResolvedValue(history),
    });

    const result = await repository.load();

    expect(result).toMatchObject({
      status: 'recovery',
      source: 'history',
      current: { updatedAt: 10 },
      data: { updatedAt: 30, incomes: [{ amountWon: 6_000_000 }] },
    });
  });

  it('does not offer an older pending draft over a newer applied revision', async () => {
    const current = validData();
    current.updatedAt = 30;
    current.incomes[0].amountWon = 6_000_000;
    current.incomes[0].allocations[0].amountWon = 6_000_000;
    const pending = validData();
    pending.updatedAt = 20;
    pending.incomes[0].amountWon = 5_000_000;
    pending.incomes[0].allocations[0].amountWon = 5_000_000;
    window.localStorage.setItem('isf-main-v1', JSON.stringify(current));
    window.localStorage.setItem('isf-main-v1-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({
      saveMainV1: vi.fn(),
      loadLatestMainV1: vi.fn().mockResolvedValue(null),
    });

    const result = await repository.load();

    expect(result).toMatchObject({
      status: 'current',
      data: { updatedAt: 30, incomes: [{ amountWon: 6_000_000 }] },
    });
  });

  it('does not let malformed current data mask a valid pending recovery draft', async () => {
    const pending = validData();
    pending.updatedAt = 20;
    pending.incomes[0].amountWon = 5_000_000;
    pending.incomes[0].allocations[0].amountWon = 5_000_000;
    window.localStorage.setItem('isf-main-v1', '{malformed-current');
    window.localStorage.setItem('isf-main-v1-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({
      saveMainV1: vi.fn(),
      loadLatestMainV1: vi.fn().mockResolvedValue(null),
    });

    const result = await repository.load();

    expect(result).toMatchObject({
      status: 'recovery',
      source: 'pending',
      current: null,
      data: { updatedAt: 20 },
    });
  });

  it('treats a pending-only first save as recovery instead of applied current data', async () => {
    const pending = validData();
    pending.updatedAt = 20;
    window.localStorage.setItem('isf-main-v1-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({
      saveMainV1: vi.fn(),
      loadLatestMainV1: vi.fn().mockResolvedValue(pending),
    });

    const result = await repository.load();

    expect(result).toMatchObject({
      status: 'recovery',
      source: 'pending',
      current: null,
      data: { updatedAt: 20 },
    });
  });

  it('projects every preserved pre-v10 monetary field as won before stamping modelVersion 10', async () => {
    window.localStorage.setItem('isf-rebuild-v1', JSON.stringify({
      modelVersion: 9,
      startCash: 500,
      householdContext: { profile: 'newlywed', incomeMode: 'dual-income', spouseMonthlyIncome: 200 },
      incomes: [{
        id: 'income-main',
        name: '급여',
        amount: 420,
        accountId: 'acc-salary',
        allocations: [{ accountId: 'acc-salary', amount: 420 }],
      }],
      expenseItems: [{ id: 'rent', name: '월세', amount: 90, accountId: 'acc-salary' }],
      savingsItems: [],
      investItems: [],
      accounts: [
        { id: 'acc-salary', name: '급여통장', type: 'income' },
        { id: 'acc-living', name: '생활비통장', type: 'spending' },
      ],
      transfers: [{
        id: 'transfer-living',
        sourceAccountId: 'acc-salary',
        targetAccountId: 'acc-living',
        amount: 30,
      }],
      relationships: [{
        id: 'relationship-rent',
        amount: 90,
        sourceRef: { collection: 'expenseItems', id: 'rent' },
      }],
    }));
    const repository = new BrowserMainRepository({ saveMainV1: vi.fn().mockResolvedValue(undefined) });
    const migrated = await repository.load();
    if (migrated.data === null) throw new Error('Expected the pre-v10 fixture to migrate.');

    await repository.save(migrated.data);

    expect(JSON.parse(window.localStorage.getItem('isf-rebuild-v1') ?? '')).toMatchObject({
      modelVersion: 10,
      startCash: 5_000_000,
      householdContext: { spouseMonthlyIncome: 2_000_000 },
      incomes: [{
        amount: 4_200_000,
        allocations: [{ amount: 4_200_000 }],
      }],
      expenseItems: [{ amount: 900_000 }],
      transfers: [{ id: 'transfer-living', amount: 300_000 }],
      relationships: [{ id: 'relationship-rent', amount: 900_000 }],
    });
  });

  it('keeps the existing main key when history persistence fails', async () => {
    const existing = validData();
    existing.updatedAt = 10;
    window.localStorage.setItem('isf-main-v1', JSON.stringify(existing));
    const repository = new BrowserMainRepository({
      saveMainV1: vi.fn().mockRejectedValue(new Error('indexeddb unavailable')),
    });

    await expect(repository.save(validData())).rejects.toThrow('indexeddb unavailable');

    expect(JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '')).toEqual(existing);
    expect(window.localStorage.getItem('isf-main-v1-pending')).toBeNull();
  });

  it('writes matching timestamps to the current key and IndexedDB history', async () => {
    const saveMainV1 = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
    const input = validData();
    const repository = new BrowserMainRepository({ saveMainV1 });

    const persisted = await repository.save(input);

    const stored = JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '');
    expect(stored.updatedAt).toBe(1_750_000_000_000);
    expect(persisted).toEqual(stored);
    expect(persisted).not.toBe(input);
    expect(saveMainV1).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: 1_750_000_000_000 }));
    expect(input.updatedAt).toBe(0);
    expect(window.localStorage.getItem('isf-main-v1-pending')).toBeNull();
  });

  it('projects a successful Main save to every live legacy connector key', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
    window.localStorage.setItem('isf-rebuild-v1', JSON.stringify({
      modelVersion: 10,
      startInvest: 12_000_000,
      annualSavingsYield: 3.2,
      annualInvestReturn: 8.5,
      horizonYears: 12,
    }));
    const input = validData();
    input.expenses = [{ id: 'rent', name: '월세', amountWon: 900_000, accountId: 'acc-salary' }];
    input.savings = [{ id: 'deposit', name: '적금', amountWon: 500_000, accountId: 'acc-salary' }];
    input.investments = [{ id: 'etf', name: 'ETF', amountWon: 700_000, accountId: 'acc-salary' }];
    const repository = new BrowserMainRepository({ saveMainV1: vi.fn().mockResolvedValue(undefined) });

    await repository.save(input);

    const legacy = JSON.parse(window.localStorage.getItem('isf-rebuild-v1') ?? '');
    const activeHistory = JSON.parse(window.localStorage.getItem('isf-step1-active') ?? '');
    expect(legacy).toMatchObject({
      modelVersion: 10,
      version: 2,
      updatedAt: 1_750_000_000_000,
      monthlyExpense: 900_000,
      monthlySavings: 500_000,
      monthlyInvest: 700_000,
      startInvest: 12_000_000,
      annualSavingsYield: 3.2,
      annualInvestReturn: 8.5,
      horizonYears: 12,
      incomes: [{ id: 'income-main', amount: 4_200_000 }],
      expenseItems: [{ id: 'rent', amount: 900_000 }],
      savingsItems: [{ id: 'deposit', amount: 500_000 }],
      investItems: [{ id: 'etf', amount: 700_000 }],
      accounts: [{ id: 'acc-salary', name: '급여통장' }],
    });
    expect(activeHistory).toEqual(legacy);
  });

  it('merges legacy metadata by stable ID while pruning deleted owners and their relationships', async () => {
    window.localStorage.setItem('isf-rebuild-v1', JSON.stringify({
      modelVersion: 10,
      householdContext: { profile: 'newlywed', incomeMode: 'dual-income' },
      accounts: [
        { id: 'acc-salary', name: '이전 급여통장', type: 'income', bankCode: 'BANK-A' },
        { id: 'acc-living', name: '이전 생활비통장', type: 'spending', color: '#0f766e' },
        { id: 'acc-ghost', name: '삭제 계좌', type: 'other', memo: 'remove me' },
      ],
      incomes: [{
        id: 'income-main',
        name: '이전 급여',
        amount: 4_000_000,
        accountId: 'acc-salary',
        payrollCode: 'P-1',
        allocations: [{ accountId: 'acc-salary', amount: 4_000_000 }],
      }],
      expenseItems: [
        {
          id: 'rent',
          name: '이전 월세',
          amount: 900_000,
          group: '고정비',
          accountId: 'acc-living',
          paymentDay: '25일',
          memo: '임대인 자동이체',
        },
        { id: 'ghost-expense', name: '삭제 지출', amount: 10_000, accountId: 'acc-ghost', memo: 'remove me' },
      ],
      savingsItems: [],
      investItems: [],
      transfers: [
        {
          id: 'transfer-living',
          sourceAccountId: 'acc-salary',
          targetAccountId: 'acc-living',
          amount: 500_000,
          label: '생활비 자동이체',
          paymentDay: '2일',
          memo: '월급 다음날',
        },
        {
          id: 'transfer-ghost',
          sourceAccountId: 'acc-salary',
          targetAccountId: 'acc-ghost',
          amount: 10_000,
          label: '삭제 이체',
        },
      ],
      relationships: [
        {
          id: 'rel-candidate-rent',
          type: 'utility-payment',
          sourceAccountId: 'acc-living',
          targetAccountId: 'merchant-rent',
          amount: 900_000,
          label: '이전 월세',
          paymentDay: '25일',
          memo: '관계 메모',
          confidence: 'confirmed',
          sourceRef: { collection: 'expenseItems', id: 'rent' },
          relationshipMeta: { lane: 'external' },
        },
        {
          id: 'rel-candidate-ghost',
          type: 'utility-payment',
          sourceAccountId: 'acc-ghost',
          targetAccountId: 'merchant-ghost',
          amount: 10_000,
          label: '삭제 관계',
          sourceRef: { collection: 'expenseItems', id: 'ghost-expense' },
        },
      ],
    }));
    const input = validData();
    input.incomes[0].amountWon = 4_500_000;
    input.incomes[0].allocations[0].amountWon = 4_500_000;
    input.accounts = [
      { id: 'acc-salary', name: '급여통장', kind: 'income' },
      { id: 'acc-living', name: '생활비통장', kind: 'spending' },
    ];
    input.expenses = [{
      id: 'rent',
      name: '월세',
      amountWon: 1_100_000,
      group: '고정비',
      accountId: 'acc-living',
    }];
    const repository = new BrowserMainRepository({ saveMainV1: vi.fn().mockResolvedValue(undefined) });

    await repository.save(input);

    const legacy = JSON.parse(window.localStorage.getItem('isf-rebuild-v1') ?? '');
    expect(legacy.householdContext).toEqual({ profile: 'newlywed', incomeMode: 'dual-income' });
    expect(legacy.accounts).toEqual([
      expect.objectContaining({ id: 'acc-salary', name: '급여통장', type: 'income', bankCode: 'BANK-A' }),
      expect.objectContaining({ id: 'acc-living', name: '생활비통장', type: 'spending', color: '#0f766e' }),
    ]);
    expect(legacy.incomes).toEqual([
      expect.objectContaining({ id: 'income-main', amount: 4_500_000, payrollCode: 'P-1' }),
    ]);
    expect(legacy.expenseItems).toEqual([
      expect.objectContaining({
        id: 'rent',
        name: '월세',
        amount: 1_100_000,
        paymentDay: '25일',
        memo: '임대인 자동이체',
      }),
    ]);
    expect(legacy.transfers).toEqual([
      expect.objectContaining({
        id: 'transfer-living',
        sourceAccountId: 'acc-salary',
        targetAccountId: 'acc-living',
        paymentDay: '2일',
        memo: '월급 다음날',
      }),
    ]);
    expect(legacy.relationships).toEqual([
      expect.objectContaining({
        id: 'rel-candidate-rent',
        sourceRef: { collection: 'expenseItems', id: 'rent' },
        relationshipMeta: { lane: 'external' },
      }),
    ]);
  });

  it('keeps separate history entries when two saves share a millisecond', async () => {
    const history = new Map<number, MainData>();
    const saveMainV1 = vi.fn(async (data: MainData) => {
      history.set(data.updatedAt, structuredClone(data));
    });
    vi.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000);
    const repository = new BrowserMainRepository({ saveMainV1 });

    await repository.save(validData());
    const second = validData();
    second.expenses = [{ id: 'rent', name: '주거비', amountWon: 900_000 }];
    await repository.save(second);

    expect(history.size).toBe(2);
    expect([...history.keys()]).toEqual([1_750_000_000_000, 1_750_000_000_001]);
    expect(JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '').updatedAt).toBe(1_750_000_000_001);
  });

  it('retains the old current data and recovery pending data when replacing the current key fails', async () => {
    const existing = validData();
    existing.updatedAt = 10;
    window.localStorage.setItem('isf-main-v1', JSON.stringify(existing));
    const existingLegacy = { modelVersion: 10, monthlyInvest: 123_000 };
    window.localStorage.setItem('isf-rebuild-v1', JSON.stringify(existingLegacy));
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    setItem.mockImplementation((key, value) => {
      if (key === 'isf-main-v1') throw new Error('quota exceeded');
      MemoryStorage.prototype.setItem.call(window.localStorage, key, value);
    });
    const repository = new BrowserMainRepository({ saveMainV1: vi.fn().mockResolvedValue(undefined) });

    await expect(repository.save(validData())).rejects.toThrow('quota exceeded');

    expect(JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '')).toEqual(existing);
    expect(JSON.parse(window.localStorage.getItem('isf-main-v1-pending') ?? '').updatedAt).toBeGreaterThan(10);
    expect(JSON.parse(window.localStorage.getItem('isf-rebuild-v1') ?? '')).toEqual(existingLegacy);
  });

  it('rolls back the current and compatibility keys when a compatibility write fails', async () => {
    const existing = validData();
    existing.updatedAt = 10;
    const existingLegacy = { modelVersion: 10, monthlyInvest: 123_000 };
    const existingActive = { modelVersion: 10, monthlyInvest: 120_000 };
    window.localStorage.setItem('isf-main-v1', JSON.stringify(existing));
    window.localStorage.setItem('isf-rebuild-v1', JSON.stringify(existingLegacy));
    window.localStorage.setItem('isf-step1-active', JSON.stringify(existingActive));
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'isf-step1-active') throw new Error('compatibility quota exceeded');
      MemoryStorage.prototype.setItem.call(window.localStorage, key, value);
    });
    const repository = new BrowserMainRepository({ saveMainV1: vi.fn().mockResolvedValue(undefined) });

    await expect(repository.save(validData())).rejects.toThrow('compatibility quota exceeded');

    expect(JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '')).toEqual(existing);
    expect(JSON.parse(window.localStorage.getItem('isf-rebuild-v1') ?? '')).toEqual(existingLegacy);
    expect(JSON.parse(window.localStorage.getItem('isf-step1-active') ?? '')).toEqual(existingActive);
    expect(JSON.parse(window.localStorage.getItem('isf-main-v1-pending') ?? '').updatedAt).toBeGreaterThan(10);
  });

  it('discards a pending recovery draft explicitly', () => {
    const pending = validData();
    pending.updatedAt = 10;
    window.localStorage.setItem('isf-main-v1-pending', JSON.stringify(pending));
    const repository = new BrowserMainRepository({ saveMainV1: vi.fn() });

    repository.discardPending(10);

    expect(window.localStorage.getItem('isf-main-v1-pending')).toBeNull();
  });

  it('does not discard or suppress a successor pending draft from another tab', () => {
    const sharedValues = new Map<string, string>();
    const target = validData();
    target.updatedAt = 10;
    const targetRaw = JSON.stringify(target);
    const successor = validData();
    successor.updatedAt = 20;
    successor.incomes[0].amountWon = 6_000_000;
    successor.incomes[0].allocations[0].amountWon = 6_000_000;
    const successorRaw = JSON.stringify(successor);
    sharedValues.set('isf-main-v1-pending', targetRaw);
    let pendingReads = 0;
    const storage = new HookedStorage(
      sharedValues,
      (_key, _value, commit) => commit(),
      (key, read) => {
        const current = read();
        if (key === 'isf-main-v1-pending') {
          pendingReads += 1;
          if (pendingReads === 2) {
            sharedValues.set(key, successorRaw);
            return successorRaw;
          }
        }
        return current;
      },
      (key, remove) => {
        if (key === 'isf-main-v1-pending' && pendingReads === 1) {
          sharedValues.set(key, successorRaw);
        }
        remove();
      },
    );
    const repository = new BrowserMainRepository(
      { saveMainV1: vi.fn() },
      undefined,
      storage,
      leaseOptions('tab-a', createControlledLeaseClock(1_000)),
    );

    repository.discardPending(10);

    expect(storage.getItem('isf-main-v1-pending')).toBe(successorRaw);
    expect(storage.getItem('isf-main-v1-dismissed-recovery')).toBeNull();
  });

  it('round-trips restart setup progress separately from first-run progress', () => {
    const repository = new BrowserMainRepository({ saveMainV1: vi.fn() });

    repository.saveSetupProgress('expense', validData(), 'restart');

    expect(repository.loadSetupProgress()).toMatchObject({
      kind: 'restart',
      step: 'expense',
      draft: { incomes: [{ amountWon: 4_200_000 }] },
    });
  });

  it('keeps two concurrent repository saves when their clocks share a millisecond', async () => {
    const history = new Map<number, MainData>();
    const saveMainV1 = vi.fn(async (data: MainData) => {
      history.set(data.updatedAt, structuredClone(data));
    });
    vi.spyOn(Date, 'now').mockReturnValue(1_850_000_000_000);
    const first = new BrowserMainRepository({ saveMainV1 });
    const second = new BrowserMainRepository({ saveMainV1 });

    await Promise.all([first.save(validData()), second.save(validData())]);

    expect(history.size).toBe(2);
    expect([...history.keys()]).toEqual([1_850_000_000_000, 1_850_000_000_001]);
  });

  it('serializes two writers so a late failing rollback cannot erase the successful revision', async () => {
    const existing = validData();
    existing.updatedAt = 10;
    window.localStorage.setItem('isf-main-v1', JSON.stringify(existing));
    let releaseFirstHistory: (() => void) | undefined;
    let firstHistoryStarted: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      firstHistoryStarted = resolve;
    });
    const firstHistory = vi.fn(() => new Promise<void>((resolve) => {
      releaseFirstHistory = resolve;
      firstHistoryStarted?.();
    }));
    const secondHistory = vi.fn().mockResolvedValue(undefined);
    const lock = createSerialLock();
    const firstRepository = new BrowserMainRepository({ saveMainV1: firstHistory }, lock);
    const secondRepository = new BrowserMainRepository({ saveMainV1: secondHistory }, lock);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'isf-step1-active' && JSON.parse(value).monthlyIncome === 5_000_000) {
        throw new Error('first compatibility write failed');
      }
      MemoryStorage.prototype.setItem.call(window.localStorage, key, value);
    });
    const firstDraft = validData();
    firstDraft.incomes[0].amountWon = 5_000_000;
    firstDraft.incomes[0].allocations[0].amountWon = 5_000_000;
    const secondDraft = validData();
    secondDraft.incomes[0].amountWon = 6_000_000;
    secondDraft.incomes[0].allocations[0].amountWon = 6_000_000;

    const firstSave = firstRepository.save(firstDraft);
    await firstStarted;
    const secondSave = secondRepository.save(secondDraft);
    await Promise.resolve();
    const secondEnteredBeforeRelease = secondHistory.mock.calls.length;
    releaseFirstHistory?.();

    await expect(firstSave).rejects.toThrow('first compatibility write failed');
    await expect(secondSave).resolves.toMatchObject({ incomes: [{ amountWon: 6_000_000 }] });
    expect(secondEnteredBeforeRelease).toBe(0);
    expect(JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '')).toMatchObject({
      incomes: [{ amountWon: 6_000_000 }],
    });
  });

  it('serializes fallback saves across independent repository and storage instances', async () => {
    const sharedValues = new Map<string, string>();
    const firstStorage = new MemoryStorage(sharedValues);
    const secondStorage = new MemoryStorage(sharedValues);
    const leaseClock = createControlledLeaseClock(1_000);
    let releaseFirstHistory: (() => void) | undefined;
    let markFirstHistoryStarted: (() => void) | undefined;
    const firstHistoryStarted = new Promise<void>((resolve) => {
      markFirstHistoryStarted = resolve;
    });
    const firstHistory = vi.fn(() => new Promise<void>((resolve) => {
      releaseFirstHistory = resolve;
      markFirstHistoryStarted?.();
    }));
    const secondHistory = vi.fn().mockResolvedValue(undefined);
    const firstRepository = new BrowserMainRepository(
      { saveMainV1: firstHistory },
      undefined,
      firstStorage,
      leaseOptions('tab-a', leaseClock),
    );
    const secondRepository = new BrowserMainRepository(
      { saveMainV1: secondHistory },
      undefined,
      secondStorage,
      leaseOptions('tab-b', leaseClock),
    );
    const firstDraft = validData();
    firstDraft.incomes[0].amountWon = 5_000_000;
    firstDraft.incomes[0].allocations[0].amountWon = 5_000_000;
    const secondDraft = validData();
    secondDraft.incomes[0].amountWon = 6_000_000;
    secondDraft.incomes[0].allocations[0].amountWon = 6_000_000;

    const firstSave = firstRepository.save(firstDraft);
    await firstHistoryStarted;
    const secondSave = secondRepository.save(secondDraft);
    await vi.waitFor(() => expect(leaseClock.pendingWaits()).toBe(1));

    expect(secondHistory).not.toHaveBeenCalled();
    releaseFirstHistory?.();
    await expect(firstSave).resolves.toMatchObject({ incomes: [{ amountWon: 5_000_000 }] });
    await leaseClock.releaseNextWait();
    await expect(secondSave).resolves.toMatchObject({ incomes: [{ amountWon: 6_000_000 }] });
    expect(secondHistory).toHaveBeenCalledOnce();
    expect(JSON.parse(secondStorage.getItem('isf-main-v1') ?? '')).toMatchObject({
      incomes: [{ amountWon: 6_000_000 }],
    });
    expectInactiveLease(secondStorage, 'tab-a');
    expectInactiveLease(secondStorage, 'tab-b');
  });

  it('lets a stale fallback lease be taken over after its owner tab disappears', async () => {
    const sharedValues = new Map<string, string>();
    const storage = new MemoryStorage(sharedValues);
    const leaseClock = createControlledLeaseClock(1_000);
    storage.setItem(
      leaseStorageKey('crashed-tab'),
      activeLeaseRecord('crashed-tab', 999),
    );
    const repository = new BrowserMainRepository(
      { saveMainV1: vi.fn().mockResolvedValue(undefined) },
      undefined,
      storage,
      leaseOptions('replacement-tab', leaseClock),
    );

    await expect(repository.save(validData())).resolves.toMatchObject({
      incomes: [{ amountWon: 4_200_000 }],
    });

    expect(storage.getItem('isf-main-v1')).not.toBeNull();
    expectInactiveLease(storage, 'replacement-tab');
  });

  it('issues a revision newer than a pending draft left by a crashed tab', async () => {
    const sharedValues = new Map<string, string>();
    const storage = new MemoryStorage(sharedValues);
    const pending = validData();
    pending.updatedAt = 100;
    storage.setItem('isf-main-v1-pending', JSON.stringify(pending));
    vi.spyOn(Date, 'now').mockReturnValue(50);
    const leaseClock = createControlledLeaseClock(1_000);
    const repository = new BrowserMainRepository(
      { saveMainV1: vi.fn().mockResolvedValue(undefined) },
      undefined,
      storage,
      leaseOptions('replacement-tab', leaseClock),
    );

    const saved = await repository.save(validData());

    expect(saved.updatedAt).toBeGreaterThan(100);
  });

  it('does not let a former lease owner release the new owner lease after stale takeover', async () => {
    const sharedValues = new Map<string, string>();
    const firstStorage = new MemoryStorage(sharedValues);
    const secondStorage = new MemoryStorage(sharedValues);
    const leaseClock = createControlledLeaseClock(1_000);
    let releaseFirstHistory: (() => void) | undefined;
    let markFirstHistoryStarted: (() => void) | undefined;
    const firstHistoryStarted = new Promise<void>((resolve) => {
      markFirstHistoryStarted = resolve;
    });
    const firstHistory = vi.fn(() => new Promise<void>((resolve) => {
      releaseFirstHistory = resolve;
      markFirstHistoryStarted?.();
    }));
    let releaseSecondHistory: (() => void) | undefined;
    let markSecondHistoryStarted: (() => void) | undefined;
    const secondHistoryStarted = new Promise<void>((resolve) => {
      markSecondHistoryStarted = resolve;
    });
    const secondHistory = vi.fn(() => new Promise<void>((resolve) => {
      releaseSecondHistory = resolve;
      markSecondHistoryStarted?.();
    }));
    const firstRepository = new BrowserMainRepository(
      { saveMainV1: firstHistory },
      undefined,
      firstStorage,
      leaseOptions('tab-a', leaseClock),
    );
    const secondRepository = new BrowserMainRepository(
      { saveMainV1: secondHistory },
      undefined,
      secondStorage,
      leaseOptions('tab-b', leaseClock),
    );

    const firstSave = firstRepository.save(validData());
    await firstHistoryStarted;
    leaseClock.setNow(1_101);
    const secondSave = secondRepository.save(validData());
    await secondHistoryStarted;
    releaseFirstHistory?.();

    await expect(firstSave).rejects.toThrow('Main save lock ownership was lost');
    expect(JSON.parse(firstStorage.getItem(leaseStorageKey('tab-b')) ?? '')).toMatchObject({
      owner: 'tab-b',
      ticket: 1,
    });

    releaseSecondHistory?.();
    await expect(secondSave).resolves.toBeTruthy();
    expectInactiveLease(secondStorage, 'tab-b');
  });

  it('does not let a late expired writer erase a newer successful fallback save', async () => {
    const sharedValues = new Map<string, string>();
    const firstStorage = new MemoryStorage(sharedValues);
    const secondStorage = new MemoryStorage(sharedValues);
    const leaseClock = createControlledLeaseClock(1_000);
    let releaseFirstHistory: (() => void) | undefined;
    let markFirstHistoryStarted: (() => void) | undefined;
    const firstHistoryStarted = new Promise<void>((resolve) => {
      markFirstHistoryStarted = resolve;
    });
    const firstHistory = vi.fn(() => new Promise<void>((resolve) => {
      releaseFirstHistory = resolve;
      markFirstHistoryStarted?.();
    }));
    const firstRepository = new BrowserMainRepository(
      { saveMainV1: firstHistory },
      undefined,
      firstStorage,
      leaseOptions('tab-a', leaseClock),
    );
    const secondRepository = new BrowserMainRepository(
      { saveMainV1: vi.fn().mockResolvedValue(undefined) },
      undefined,
      secondStorage,
      leaseOptions('tab-b', leaseClock),
    );
    const firstDraft = validData();
    firstDraft.incomes[0].amountWon = 5_000_000;
    firstDraft.incomes[0].allocations[0].amountWon = 5_000_000;
    const secondDraft = validData();
    secondDraft.incomes[0].amountWon = 6_000_000;
    secondDraft.incomes[0].allocations[0].amountWon = 6_000_000;

    const firstSave = firstRepository.save(firstDraft);
    await firstHistoryStarted;
    leaseClock.setNow(1_101);
    const secondSave = secondRepository.save(secondDraft);
    await expect(secondSave).resolves.toMatchObject({ incomes: [{ amountWon: 6_000_000 }] });
    releaseFirstHistory?.();

    await expect(firstSave).rejects.toThrow('Main save lock ownership was lost');
    expect(JSON.parse(firstStorage.getItem('isf-main-v1') ?? '')).toMatchObject({
      incomes: [{ amountWon: 6_000_000 }],
    });
  });

  it('does not roll back snapshots when current no longer matches the failing writer revision', async () => {
    const sharedValues = new Map<string, string>();
    const current = validData();
    current.updatedAt = 10;
    sharedValues.set('isf-main-v1', JSON.stringify(current));
    const newer = validData();
    newer.updatedAt = 9_999;
    newer.incomes[0].amountWon = 6_000_000;
    newer.incomes[0].allocations[0].amountWon = 6_000_000;
    const newerLegacy = JSON.stringify({ modelVersion: 10, updatedAt: 9_999, monthlyIncome: 6_000_000 });
    const storage = new HookedStorage(sharedValues, (key, value, commit) => {
      commit();
      if (key !== 'isf-step1-active') return;
      sharedValues.set('isf-main-v1', JSON.stringify(newer));
      sharedValues.set('isf-rebuild-v1', newerLegacy);
      sharedValues.set('isf-step1-active', newerLegacy);
      throw new Error('late compatibility failure');
    });
    const leaseClock = createControlledLeaseClock(1_000);
    const failingDraft = validData();
    failingDraft.incomes[0].amountWon = 5_000_000;
    failingDraft.incomes[0].allocations[0].amountWon = 5_000_000;
    const repository = new BrowserMainRepository(
      { saveMainV1: vi.fn().mockResolvedValue(undefined) },
      undefined,
      storage,
      leaseOptions('tab-a', leaseClock),
    );

    await expect(repository.save(failingDraft)).rejects.toThrow('late compatibility failure');

    expect(JSON.parse(storage.getItem('isf-main-v1') ?? '')).toEqual(newer);
    expect(storage.getItem('isf-rebuild-v1')).toBe(newerLegacy);
    expect(storage.getItem('isf-step1-active')).toBe(newerLegacy);
  });

  it('rechecks ownership and current immediately before each rollback mutation', async () => {
    const sharedValues = new Map<string, string>();
    const current = validData();
    current.updatedAt = 10;
    const previousLegacy = JSON.stringify({ modelVersion: 10, updatedAt: 10, monthlyIncome: 4_200_000 });
    sharedValues.set('isf-main-v1', JSON.stringify(current));
    sharedValues.set('isf-rebuild-v1', previousLegacy);
    const newer = validData();
    newer.updatedAt = 9_999;
    newer.incomes[0].amountWon = 6_000_000;
    newer.incomes[0].allocations[0].amountWon = 6_000_000;
    const newerRaw = JSON.stringify(newer);
    const newerLegacy = JSON.stringify({ modelVersion: 10, updatedAt: 9_999, monthlyIncome: 6_000_000 });
    let replaceDuringLegacyRollback = false;
    const storage = new HookedStorage(
      sharedValues,
      (key, _value, commit) => {
        if (key === 'isf-step1-active') {
          replaceDuringLegacyRollback = true;
          throw new Error('compatibility write failed');
        }
        commit();
      },
      (key, read) => {
        const currentValue = read();
        if (key === 'isf-rebuild-v1' && replaceDuringLegacyRollback) {
          replaceDuringLegacyRollback = false;
          sharedValues.set('isf-main-v1', newerRaw);
          sharedValues.set('isf-rebuild-v1', newerLegacy);
        }
        return currentValue;
      },
    );
    const leaseClock = createControlledLeaseClock(1_000);
    const repository = new BrowserMainRepository(
      { saveMainV1: vi.fn().mockResolvedValue(undefined) },
      undefined,
      storage,
      leaseOptions('tab-a', leaseClock),
    );

    await expect(repository.save(validData())).rejects.toThrow('compatibility write failed');

    expect(storage.getItem('isf-main-v1')).toBe(newerRaw);
    expect(storage.getItem('isf-rebuild-v1')).toBe(newerLegacy);
  });

  it('does not remove a successor pending draft during an older writer success cleanup', async () => {
    const sharedValues = new Map<string, string>();
    const successor = validData();
    successor.updatedAt = 9_999;
    successor.incomes[0].amountWon = 6_000_000;
    successor.incomes[0].allocations[0].amountWon = 6_000_000;
    const successorRaw = JSON.stringify(successor);
    let replacePendingOnRead = false;
    const storage = new HookedStorage(
      sharedValues,
      (key, _value, commit) => {
        commit();
        if (key === 'isf-step1-active') replacePendingOnRead = true;
      },
      (key, read) => {
        if (key === 'isf-main-v1-pending' && replacePendingOnRead) {
          replacePendingOnRead = false;
          sharedValues.set(key, successorRaw);
        }
        return read();
      },
      (key, remove) => {
        if (key === 'isf-main-v1-pending' && replacePendingOnRead) {
          replacePendingOnRead = false;
          sharedValues.set(key, successorRaw);
        }
        remove();
      },
    );
    const leaseClock = createControlledLeaseClock(1_000);
    const repository = new BrowserMainRepository(
      { saveMainV1: vi.fn().mockResolvedValue(undefined) },
      undefined,
      storage,
      leaseOptions('tab-a', leaseClock),
    );

    await expect(repository.save(validData())).resolves.toBeTruthy();

    expect(storage.getItem('isf-main-v1-pending')).toBe(successorRaw);
  });

  it('bounds fallback lease acquisition and leaves the draft untouched when another owner stays active', async () => {
    const sharedValues = new Map<string, string>();
    const storage = new MemoryStorage(sharedValues);
    let now = 1_000;
    storage.setItem(
      leaseStorageKey('active-tab'),
      activeLeaseRecord('active-tab', 5_000),
    );
    const history = vi.fn();
    const input = validData();
    const repository = new BrowserMainRepository(
      { saveMainV1: history },
      undefined,
      storage,
      {
        ...leaseOptions('waiting-tab', createControlledLeaseClock(1_000)),
        now: () => now,
        wait: async (delayMs: number) => {
          now += delayMs;
        },
        acquireTimeoutMs: 20,
        retryDelayMs: 10,
      },
    );

    await expect(repository.save(input)).rejects.toThrow('Could not acquire the Main save lock');

    expect(history).not.toHaveBeenCalled();
    expect(storage.getItem('isf-main-v1')).toBeNull();
    expect(storage.getItem('isf-main-v1-pending')).toBeNull();
    expect(input.updatedAt).toBe(0);
    expect(JSON.parse(storage.getItem(leaseStorageKey('active-tab')) ?? '')).toMatchObject({
      owner: 'active-tab',
      ticket: 1,
    });
    expectInactiveLease(storage, 'waiting-tab');
  });

  it('exposes a pending recovery draft without replacing the last applied current data', async () => {
    const existing = validData();
    existing.updatedAt = 10;
    window.localStorage.setItem('isf-main-v1', JSON.stringify(existing));
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'isf-main-v1') throw new Error('quota exceeded');
      MemoryStorage.prototype.setItem.call(window.localStorage, key, value);
    });
    const failedSave = new BrowserMainRepository({ saveMainV1: vi.fn().mockResolvedValue(undefined) });

    await expect(failedSave.save(validData())).rejects.toThrow('quota exceeded');
    const recovered = await new BrowserMainRepository({ saveMainV1: vi.fn() }).load();

    expect(recovered).toMatchObject({
      status: 'recovery',
      current: { updatedAt: 10 },
    });
    expect(recovered.data?.updatedAt).toBeGreaterThan(10);
    expect(JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '')).toEqual(existing);
  });
});

function createSerialLock() {
  let tail = Promise.resolve();
  const guard = { assertOwned: () => undefined };
  return {
    runExclusive<T>(task: (guard: { assertOwned(): void }) => Promise<T>): Promise<T> {
      const result = tail.then(() => task(guard), () => task(guard));
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}

interface ControlledLeaseClock {
  now(): number;
  wait(delayMs: number): Promise<void>;
  pendingWaits(): number;
  releaseNextWait(): Promise<void>;
  setNow(value: number): void;
}

function createControlledLeaseClock(initialNow: number): ControlledLeaseClock {
  let now = initialNow;
  const waiters: Array<{ delayMs: number; resolve: () => void }> = [];
  return {
    now: () => now,
    wait: (delayMs) => new Promise<void>((resolve) => {
      waiters.push({ delayMs, resolve });
    }),
    pendingWaits: () => waiters.length,
    releaseNextWait: async () => {
      const waiter = waiters.shift();
      if (waiter === undefined) throw new Error('Expected a pending lease wait.');
      now += waiter.delayMs;
      waiter.resolve();
      await Promise.resolve();
    },
    setNow: (value) => {
      now = value;
    },
  };
}

function leaseOptions(owner: string, clock: ControlledLeaseClock) {
  return {
    createOwnerToken: () => owner,
    now: clock.now,
    wait: clock.wait,
    yieldAfterClaim: async () => undefined,
    leaseDurationMs: 100,
    acquireTimeoutMs: 500,
    retryDelayMs: 10,
  };
}

function leaseStorageKey(owner: string): string {
  return `isf-main-v1-save-lease:${encodeURIComponent(owner)}`;
}

function activeLeaseRecord(owner: string, expiresAt: number, ticket = 1): string {
  return JSON.stringify({
    owner,
    choosing: false,
    ticket,
    expiresAt,
  });
}

function expectInactiveLease(storage: Storage, owner: string): void {
  expect(JSON.parse(storage.getItem(leaseStorageKey(owner)) ?? '')).toEqual({
    owner,
    choosing: false,
    ticket: 0,
    expiresAt: 0,
  });
}

function releaseClaim(
  waiters: Array<{ owner: string; resolve: () => void }>,
  owner: string,
): void {
  const index = waiters.findIndex((waiter) => waiter.owner === owner);
  if (index === -1) throw new Error(`Expected a pending claim for ${owner}.`);
  waiters.splice(index, 1)[0]?.resolve();
}
