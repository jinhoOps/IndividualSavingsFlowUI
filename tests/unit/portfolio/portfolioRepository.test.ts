import { beforeEach, describe, expect, it } from 'vitest';
import { createCashOnlyDraft } from '../../../src/portfolio/domain/allocation';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import {
  BrowserPortfolioRepository,
  PORTFOLIO_APPLIED_KEY,
  PORTFOLIO_DRAFT_KEY,
} from '../../../src/portfolio/infrastructure/portfolioRepository';
import { MemoryStorage } from '../simulation/MemoryStorage';

const plan: PortfolioPlan = {
  schemaVersion: 2,
  scope: { type: 'aggregate' },
  items: [{ id: 'a', name: '인덱스', shareUnits: 600_000, order: 0 }],
  cashShareUnits: 400_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 1,
  updatedAt: 1,
};

describe('BrowserPortfolioRepository', () => {
  let storage: MemoryStorage;

  beforeEach(() => { storage = new MemoryStorage(); });

  it('loads applied and draft independently', () => {
    storage.setItem(PORTFOLIO_APPLIED_KEY, JSON.stringify(plan));
    storage.setItem(PORTFOLIO_DRAFT_KEY, '{');
    expect(new BrowserPortfolioRepository(() => storage).load()).toEqual({
      applied: { status: 'found', plan },
      draft: { status: 'invalid' },
    });
  });

  it('saves current keys without touching legacy Portfolio data', () => {
    const legacyPlans = '{"legacy":"plans"}';
    const legacySnapshots = '{"legacy":"snapshots"}';
    storage.setItem('isf-step3-portfolios-v2', legacyPlans);
    storage.setItem('isf-step3-snapshots-v1', legacySnapshots);
    const repository = new BrowserPortfolioRepository(() => storage);

    expect(repository.saveApplied(plan)).toEqual({ status: 'saved' });
    expect(repository.saveDraft(createCashOnlyDraft(200_000, 2))).toEqual({ status: 'saved' });
    expect(repository.clearDraft()).toEqual({ status: 'saved' });
    expect(repository.clearAll()).toEqual({ status: 'saved' });
    expect(storage.getItem('isf-step3-portfolios-v2')).toBe(legacyPlans);
    expect(storage.getItem('isf-step3-snapshots-v1')).toBe(legacySnapshots);
  });

  it('reports unavailable for every operation when storage access throws', () => {
    const repository = new BrowserPortfolioRepository(() => { throw new Error('blocked'); });

    expect(repository.load()).toEqual({
      applied: { status: 'unavailable' },
      draft: { status: 'unavailable' },
    });
    expect(repository.saveApplied(plan)).toEqual({ status: 'unavailable' });
    expect(repository.saveDraft(createCashOnlyDraft(200_000, 2))).toEqual({ status: 'unavailable' });
    expect(repository.clearDraft()).toEqual({ status: 'unavailable' });
    expect(repository.clearAll()).toEqual({ status: 'unavailable' });
  });
});
