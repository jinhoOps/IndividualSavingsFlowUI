import { describe, expect, it } from 'vitest';
import { bootstrapPortfolio } from '../../../src/portfolio/application/bootstrap';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import type { PortfolioStorageLoadResult } from '../../../src/portfolio/infrastructure/portfolioRepository';

const plan: PortfolioPlan = {
  schemaVersion: 2,
  items: [{
    id: 'a', name: '인덱스', shareUnits: 600_000, order: 0,
    classification: 'growth', classificationOrigin: 'automatic',
  }],
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
  it('starts a cash-only v2 draft from the latest Main investment when storage is empty', () => {
    expect(bootstrapPortfolio(
      { status: 'found', source: { monthlyInvestmentWon: 200_000, mainUpdatedAt: 2 } },
      empty,
      3,
    )).toMatchObject({
      kind: 'ready',
      plan: null,
      draft: {
        schemaVersion: 2,
        items: [],
        cashShareUnits: 1_000_000,
        syncedInvestmentWon: 200_000,
        isApplicable: true,
      },
    });
  });

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

  it('ignores a draft older than the applied plan after partial cleanup failure', () => {
    const newerPlan = { ...plan, appliedAt: 5, updatedAt: 5 };
    const staleDraft = {
      schemaVersion: 2 as const,
      items: [{
        id: 'old', name: '이전 초안', shareUnits: 500_000, order: 0,
        classification: 'growth' as const, classificationOrigin: 'automatic' as const,
      }],
      cashShareUnits: 500_000,
      cashMode: 'automatic' as const,
      inputMode: 'amount' as const,
      syncedInvestmentWon: 200_000,
      updatedAt: 4,
      isApplicable: true,
    };

    expect(bootstrapPortfolio(
      { status: 'found', source: { monthlyInvestmentWon: 200_000, mainUpdatedAt: 2 } },
      {
        applied: { status: 'found', plan: newerPlan },
        draft: { status: 'found', draft: staleDraft },
      },
      6,
    )).toMatchObject({
      kind: 'ready',
      draft: { items: newerPlan.items, updatedAt: 5 },
    });
  });

  it('resumes a newer draft when Main investment changes', () => {
    const newerDraft = {
      schemaVersion: 2 as const,
      items: [{
        id: 'draft', name: '성장', shareUnits: 500_000, order: 0,
        classification: 'growth' as const, classificationOrigin: 'automatic' as const,
      }],
      cashShareUnits: 500_000,
      cashMode: 'automatic' as const,
      inputMode: 'amount' as const,
      syncedInvestmentWon: 200_000,
      updatedAt: 2,
      isApplicable: true,
    };

    const first = bootstrapPortfolio(
      { status: 'found', source: { monthlyInvestmentWon: 300_000, mainUpdatedAt: 3 } },
      {
        applied: { status: 'found', plan },
        draft: { status: 'found', draft: newerDraft },
      },
      4,
    );
    expect(first).toMatchObject({
      kind: 'ready',
      plan: { syncedInvestmentWon: 300_000 },
      shouldPersistDraft: true,
      draft: {
        items: [{ id: 'draft', name: '성장', order: 0 }],
        syncedInvestmentWon: 300_000,
      },
    });
    if (first.kind !== 'ready' || first.plan === null) throw new Error('expected ready plan');

    expect(bootstrapPortfolio(
      { status: 'found', source: { monthlyInvestmentWon: 300_000, mainUpdatedAt: 3 } },
      {
        applied: { status: 'found', plan: first.plan },
        draft: { status: 'found', draft: first.draft },
      },
      6,
    )).toMatchObject({
      kind: 'ready',
      draft: { items: [{ id: 'draft', name: '성장', order: 0 }] },
    });
  });

  it('advances and persists an already Main-synced dirty draft above a synchronized plan', () => {
    const alreadySyncedDraft = {
      schemaVersion: 2 as const,
      items: [{
        id: 'draft', name: '성장', shareUnits: 500_000, order: 0,
        classification: 'growth' as const, classificationOrigin: 'automatic' as const,
      }],
      cashShareUnits: 500_000,
      cashMode: 'automatic' as const,
      inputMode: 'amount' as const,
      syncedInvestmentWon: 300_000,
      updatedAt: 2,
      isApplicable: true,
    };
    const result = bootstrapPortfolio(
      { status: 'found', source: { monthlyInvestmentWon: 300_000, mainUpdatedAt: 3 } },
      {
        applied: { status: 'found', plan },
        draft: { status: 'found', draft: alreadySyncedDraft },
      },
      4,
    );

    expect(result).toMatchObject({
      kind: 'ready',
      shouldPersistApplied: true,
      shouldPersistDraft: true,
      plan: { updatedAt: 4 },
      draft: { updatedAt: 5, items: alreadySyncedDraft.items },
    });
  });
});
