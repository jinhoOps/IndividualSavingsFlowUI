import { describe, expect, it } from 'vitest';
import {
  BrowserPortfolioPreferencesRepository,
  PORTFOLIO_VIEW_PREFERENCES_KEY,
} from '../../../src/portfolio/infrastructure/portfolioPreferencesRepository';

const defaults = { showAmounts: false, sortMode: 'ratio' } as const;

describe('BrowserPortfolioPreferencesRepository', () => {
  it('uses defaults until it saves and reloads valid preferences', () => {
    const storage = new MapStorage();
    const repository = new BrowserPortfolioPreferencesRepository(() => storage);

    expect(repository.load()).toEqual(defaults);
    expect(repository.save({ showAmounts: true, sortMode: 'input' })).toEqual({ status: 'saved' });
    expect(new BrowserPortfolioPreferencesRepository(() => storage).load())
      .toEqual({ showAmounts: true, sortMode: 'input' });
  });

  it.each([
    ['invalid JSON', '{'],
    ['an unknown key', JSON.stringify({ showAmounts: true, sortMode: 'input', unknown: true })],
    ['an invalid value', JSON.stringify({ showAmounts: 'true', sortMode: 'input' })],
  ])('returns defaults for %s', (_reason, invalidValue) => {
    const storage = new MapStorage();
    storage.setItem(PORTFOLIO_VIEW_PREFERENCES_KEY, invalidValue);

    expect(new BrowserPortfolioPreferencesRepository(() => storage).load()).toEqual(defaults);
  });

  it('returns defaults and reports an unavailable write when storage throws', () => {
    const repository = new BrowserPortfolioPreferencesRepository(() => {
      throw new Error('storage blocked');
    });

    expect(repository.load()).toEqual(defaults);
    expect(repository.save({ showAmounts: true, sortMode: 'input' })).toEqual({ status: 'unavailable' });
  });
});

class MapStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}
