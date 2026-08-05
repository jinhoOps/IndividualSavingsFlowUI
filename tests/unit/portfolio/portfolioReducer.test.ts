import { describe, expect, it } from 'vitest';
import { draftFromPlan, type PortfolioBootstrapResult } from '../../../src/portfolio/application/bootstrap';
import {
  createPortfolioState,
  portfolioReducer,
} from '../../../src/portfolio/application/portfolioReducer';
import { createCashOnlyDraft } from '../../../src/portfolio/domain/allocation';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';

const plan: PortfolioPlan = {
  schemaVersion: 1,
  items: [{ id: 'a', name: '인덱스', shareUnits: 600_000, order: 0 }],
  cashShareUnits: 400_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 1,
  updatedAt: 1,
};
const readyWithoutPlan: Extract<PortfolioBootstrapResult, { kind: 'ready' }> = {
  kind: 'ready',
  plan: null,
  draft: createCashOnlyDraft(200_000, 1),
  shouldPersistApplied: false,
  shouldPersistDraft: false,
  persistenceAvailable: true,
};
const readyWithPlan: Extract<PortfolioBootstrapResult, { kind: 'ready' }> = {
  ...readyWithoutPlan,
  plan,
  draft: draftFromPlan(plan),
};

describe('portfolioReducer', () => {
  it('opens first-run setup but revisits a saved plan result-first', () => {
    expect(createPortfolioState(readyWithoutPlan).view).toBe('edit');
    expect(createPortfolioState(readyWithPlan).view).toBe('result');
  });

  it('resumes a saved draft in editing when it differs from the applied plan', () => {
    const changedDraft = {
      ...draftFromPlan(plan),
      items: [{ ...plan.items[0], shareUnits: 500_000 }],
      cashShareUnits: 500_000,
      updatedAt: 2,
    };
    const state = createPortfolioState({ ...readyWithPlan, draft: changedDraft });

    expect(state.view).toBe('edit');
    expect(state.dirty).toBe(true);
  });

  it('keeps applied result unchanged while draft changes', () => {
    const state = createPortfolioState(readyWithPlan);
    const next = portfolioReducer(state, {
      type: 'draft-item-amount-changed',
      id: 'a',
      amountWon: 50_000,
      now: 2,
    });
    expect(next.applied).toEqual(plan);
    expect(next.draft).not.toEqual(state.draft);
    expect(next.dirty).toBe(true);
  });

  it('cancel discards the draft and returns to result', () => {
    const changed = portfolioReducer(createPortfolioState(readyWithPlan), {
      type: 'draft-item-amount-changed', id: 'a', amountWon: 50_000, now: 2,
    });
    const cancelled = portfolioReducer(changed, { type: 'cancel-edit' });
    expect(cancelled.draft).toEqual(draftFromPlan(plan));
    expect(cancelled.view).toBe('result');
    expect(cancelled.dirty).toBe(false);
  });

  it('confirmed reset creates an applied cash-only plan', () => {
    const reset = portfolioReducer(createPortfolioState(readyWithPlan), {
      type: 'reset-confirmed', now: 3,
    });
    expect(reset.applied?.items).toEqual([]);
    expect(reset.applied?.cashShareUnits).toBe(1_000_000);
    expect(reset.view).toBe('result');
  });

  it('opening edit and changing only the input mode do not dirty allocation', () => {
    const opened = portfolioReducer(createPortfolioState(readyWithPlan), { type: 'edit-opened' });
    const switched = portfolioReducer(opened, { type: 'input-mode-changed', mode: 'percentage' });
    expect(switched.view).toBe('edit');
    expect(switched.dirty).toBe(false);
  });
});
