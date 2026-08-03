import { beforeEach, describe, expect, it } from 'vitest';
import {
  BrowserPortfolioMainSourceRepository,
  type PortfolioMainSourceRepository,
} from '../../../src/portfolio/infrastructure/mainSourceRepository';
import { MemoryStorage } from '../simulation/MemoryStorage';

describe('BrowserPortfolioMainSourceRepository', () => {
  let storage: MemoryStorage;

  beforeEach(() => { storage = new MemoryStorage(); });

  it('reads only current Main investment and timestamp', () => {
    storage.setItem('isf-main-v2', JSON.stringify({
      schemaVersion: 2,
      updatedAt: 10,
      monthlyNetIncomeWon: 3_000_000,
      monthlyHousingWon: 700_000,
      monthlyLivingWon: 900_000,
      monthlySavingWon: 400_000,
      monthlyInvestmentWon: 250_000,
    }));
    expect(new BrowserPortfolioMainSourceRepository(() => storage).load()).toEqual({
      status: 'found',
      source: { monthlyInvestmentWon: 250_000, mainUpdatedAt: 10 },
    });
  });

  it('does not read legacy Main keys', () => {
    storage.setItem('isf-rebuild-v1', JSON.stringify({ monthlyInvest: 999_000 }));
    expect(new BrowserPortfolioMainSourceRepository(() => storage).load()).toEqual({ status: 'empty' });
  });

  it('distinguishes invalid and unavailable storage', () => {
    storage.setItem('isf-main-v2', '{');
    expect(new BrowserPortfolioMainSourceRepository(() => storage).load()).toEqual({ status: 'invalid' });
    const repository: PortfolioMainSourceRepository = new BrowserPortfolioMainSourceRepository(() => {
      throw new DOMException('blocked');
    });
    expect(repository.load()).toEqual({ status: 'unavailable' });
  });
});
