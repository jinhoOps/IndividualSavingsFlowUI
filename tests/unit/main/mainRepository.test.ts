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
});
