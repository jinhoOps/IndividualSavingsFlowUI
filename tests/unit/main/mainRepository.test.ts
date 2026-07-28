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
      incomes: [{
        id: 'income-main', name: '급여', amount: 4_200_000,
        allocations: [{ accountId: 'acc-salary', amount: 4_200_000 }],
      }],
      expenseItems: [], savingsItems: [], investItems: [],
      accounts: [{ id: 'acc-salary', name: '급여통장', type: 'income' }],
    }));

    const result = await new BrowserMainRepository({ saveMainV1: vi.fn() }).load();

    expect(result.status).toBe('migrated');
    expect(result.data?.incomes[0].amountWon).toBe(4_200_000);
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

    await repository.save(input);

    const stored = JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '');
    expect(stored.updatedAt).toBe(1_750_000_000_000);
    expect(saveMainV1).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: 1_750_000_000_000 }));
    expect(input.updatedAt).toBe(0);
    expect(window.localStorage.getItem('isf-main-v1-pending')).toBeNull();
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
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    setItem.mockImplementation((key, value) => {
      if (key === 'isf-main-v1') throw new Error('quota exceeded');
      MemoryStorage.prototype.setItem.call(window.localStorage, key, value);
    });
    const repository = new BrowserMainRepository({ saveMainV1: vi.fn().mockResolvedValue(undefined) });

    await expect(repository.save(validData())).rejects.toThrow('quota exceeded');

    expect(JSON.parse(window.localStorage.getItem('isf-main-v1') ?? '')).toEqual(existing);
    expect(JSON.parse(window.localStorage.getItem('isf-main-v1-pending') ?? '').updatedAt).toBeGreaterThan(10);
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
