import { beforeEach, describe, expect, it } from 'vitest';
import {
  BrowserMainSourceRepository,
  MAIN_STORAGE_KEY,
} from '../../../src/simulation/infrastructure/mainSourceRepository';
import { MemoryStorage } from './MemoryStorage';

describe('BrowserMainSourceRepository', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('projects only current Main savings, investments, and revision time', () => {
    storage.setItem(MAIN_STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      updatedAt: 123,
      monthlyNetIncomeWon: 3_200_000,
      monthlyHousingWon: 800_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 300_000,
      monthlyInvestmentWon: 200_000,
    }));

    expect(new BrowserMainSourceRepository(() => storage).load()).toEqual({
      status: 'found',
      source: {
        monthlySavingsWon: 300_000,
        monthlyInvestmentWon: 200_000,
        mainUpdatedAt: 123,
      },
    });
  });

  it('does not read a legacy Main key when current Main is absent', () => {
    storage.setItem('isf-rebuild-v1', JSON.stringify({
      monthlyInvest: 900_000,
    }));
    expect(new BrowserMainSourceRepository(() => storage).load()).toEqual({ status: 'empty' });
  });

  it('distinguishes malformed Main data from unavailable storage', () => {
    storage.setItem(MAIN_STORAGE_KEY, '{broken');
    expect(new BrowserMainSourceRepository(() => storage).load()).toEqual({ status: 'invalid' });
    expect(new BrowserMainSourceRepository(() => {
      throw new DOMException('blocked', 'SecurityError');
    }).load()).toEqual({ status: 'unavailable' });
  });
});
