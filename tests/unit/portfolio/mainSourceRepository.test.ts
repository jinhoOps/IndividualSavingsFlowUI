import { beforeEach, describe, expect, it } from 'vitest';
import { isMainDataShape } from '../../../src/main/domain/validation';
import {
  BrowserPortfolioMainSourceRepository,
  type PortfolioMainSourceRepository,
} from '../../../src/portfolio/infrastructure/mainSourceRepository';
import { MemoryStorage } from '../simulation/MemoryStorage';

const validMain = {
  schemaVersion: 2,
  updatedAt: 10,
  monthlyNetIncomeWon: 3_000_000,
  monthlyHousingWon: 700_000,
  monthlyLivingWon: 900_000,
  monthlySavingWon: 400_000,
  monthlyInvestmentWon: 250_000,
};

describe('BrowserPortfolioMainSourceRepository', () => {
  let storage: MemoryStorage;

  beforeEach(() => { storage = new MemoryStorage(); });

  it.each([
    ['schema v1', { ...validMain, schemaVersion: 1 }, false],
    ['negative amount', { ...validMain, monthlyInvestmentWon: -1 }, false],
    ['extra key', { ...validMain, accountId: 'legacy-account' }, false],
    ['valid v2', validMain, true],
  ] as const)('matches the canonical Main shape for %s', (_label, candidate, expected) => {
    expect(isMainDataShape(candidate)).toBe(expected);
    storage.setItem('isf-main-v2', JSON.stringify(candidate));

    expect(new BrowserPortfolioMainSourceRepository(() => storage).load()).toEqual(
      expected
        ? {
          status: 'found',
          source: { monthlyInvestmentWon: 250_000, mainUpdatedAt: 10 },
        }
        : { status: 'invalid' },
    );
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
