import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserMainRepository } from '../../../src/main/infrastructure/mainRepository';
import type { MainData } from '../../../src/main/domain/model';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

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
    window.localStorage.setItem('isf-main-v1-pending', JSON.stringify(validData()));
    const repository = new BrowserMainRepository({ saveMainV1: vi.fn() });

    repository.discardPending();

    expect(window.localStorage.getItem('isf-main-v1-pending')).toBeNull();
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
  return {
    runExclusive<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task, task);
      tail = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
