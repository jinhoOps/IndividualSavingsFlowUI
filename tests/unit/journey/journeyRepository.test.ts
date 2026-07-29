import { beforeEach, describe, expect, it } from 'vitest';
import {
  BrowserJourneyRepository,
  JOURNEY_STORAGE_KEY,
} from '../../../src/journey/infrastructure/journeyRepository';

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

beforeEach(() => {
  const storage = new MemoryStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  localStorage.clear();
});

describe('BrowserJourneyRepository', () => {
  it('round-trips one valid snapshot through its dedicated key', () => {
    const repository = new BrowserJourneyRepository();
    const snapshot = {
      version: 1 as const,
      sourceApp: 'main' as const,
      sourceView: 'dashboard' as const,
      destinationApp: 'simulation' as const,
      monthlyInvestableAmountWon: 1_100_000,
      mainUpdatedAt: 10,
      createdAt: 20,
    };
    repository.save(snapshot);
    expect(repository.load()).toEqual({ status: 'found', snapshot });
    expect(JOURNEY_STORAGE_KEY).toBe('isf-journey-snapshot-v1');
  });

  it('returns invalid for malformed storage without throwing', () => {
    localStorage.setItem(JOURNEY_STORAGE_KEY, '{broken');
    expect(new BrowserJourneyRepository().load()).toEqual({ status: 'invalid' });
  });

  it('propagates the original storage error when saving', () => {
    const error = new Error('Storage quota exceeded');
    window.localStorage.setItem = () => {
      throw error;
    };

    expect(() => new BrowserJourneyRepository().save({
      version: 1,
      sourceApp: 'main',
      sourceView: 'dashboard',
      destinationApp: 'simulation',
      monthlyInvestableAmountWon: 1_100_000,
      mainUpdatedAt: 10,
      createdAt: 20,
    })).toThrow(error);
  });
});
