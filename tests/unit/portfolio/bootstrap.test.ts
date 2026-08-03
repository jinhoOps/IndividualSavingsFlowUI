import { describe, expect, it } from 'vitest';
import { bootstrapPortfolio } from '../../../src/portfolio/application/bootstrap';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import type { PortfolioStorageLoadResult } from '../../../src/portfolio/infrastructure/portfolioRepository';

const plan: PortfolioPlan = {
  schemaVersion: 1,
  items: [{ id: 'a', name: '인덱스', shareUnits: 600_000, order: 0 }],
  cashShareUnits: 400_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 1,
  updatedAt: 1,
};
const saved: PortfolioStorageLoadResult = {
  applied: { status: 'found', plan },
  draft: { status: 'empty' },
};
const empty: PortfolioStorageLoadResult = {
  applied: { status: 'empty' },
  draft: { status: 'empty' },
};

describe('bootstrapPortfolio', () => {
  it.each(['empty', 'invalid'] as const)('requires Main for %s source', (status) => {
    expect(bootstrapPortfolio({ status }, empty, 1)).toEqual({
      kind: 'main-required',
      reason: status,
    });
  });

  it('keeps a saved plan behind the zero-investment gate', () => {
    expect(bootstrapPortfolio(
      { status: 'found', source: { monthlyInvestmentWon: 0, mainUpdatedAt: 2 } },
      saved,
      3,
    )).toEqual({ kind: 'investment-required', preservedPlan: plan, reason: 'zero-investment' });
  });

  it('syncs a found plan to the latest Main investment', () => {
    expect(bootstrapPortfolio(
      { status: 'found', source: { monthlyInvestmentWon: 300_000, mainUpdatedAt: 2 } },
      saved,
      3,
    )).toMatchObject({
      kind: 'ready',
      shouldPersistApplied: true,
      plan: { syncedInvestmentWon: 300_000, cashShareUnits: 600_000 },
    });
  });

  it('uses a saved plan without rescaling when Main is unavailable', () => {
    expect(bootstrapPortfolio({ status: 'unavailable' }, saved, 3)).toEqual({
      kind: 'stale-main',
      plan,
      draft: null,
      persistenceAvailable: true,
    });
  });
});
