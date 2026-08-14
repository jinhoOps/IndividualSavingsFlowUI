import { describe, expect, it } from 'vitest';
import { draftFromPlan, type PortfolioBootstrapResult } from '../../../src/portfolio/application/bootstrap';
import {
  createPortfolioState,
  portfolioReducer,
} from '../../../src/portfolio/application/portfolioReducer';
import { createCashOnlyDraft, materializeAllocation } from '../../../src/portfolio/domain/allocation';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';

const plan: PortfolioPlan = {
  schemaVersion: 2,
  scope: { type: 'aggregate' },
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
  it('opens first-run welcome but revisits a saved plan result-first', () => {
    expect(createPortfolioState(readyWithoutPlan)).toMatchObject({
      view: 'setup',
      setupStep: 'welcome',
      dirty: false,
    });
    expect(createPortfolioState(readyWithPlan).view).toBe('result');
  });

  it('resumes a changed first-time draft at allocation', () => {
    const changed = portfolioReducer(createPortfolioState(readyWithoutPlan), {
      type: 'draft-item-added',
      item: { id: 'index', name: '인덱스', order: 0 },
      now: 2,
    });

    const resumed = createPortfolioState({ ...readyWithoutPlan, draft: changed.draft });

    expect(resumed).toMatchObject({ view: 'setup', setupStep: 'allocation', dirty: true });
  });

  it('moves through setup without changing the draft', () => {
    const initial = createPortfolioState(readyWithoutPlan);
    const allocation = portfolioReducer(initial, { type: 'setup-next' });
    const review = portfolioReducer(allocation, { type: 'setup-next' });
    const previous = portfolioReducer(review, { type: 'setup-previous' });

    expect(allocation.setupStep).toBe('allocation');
    expect(review.setupStep).toBe('review');
    expect(previous.setupStep).toBe('allocation');
    expect(review.draft).toEqual(initial.draft);
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

  it('confirmed reset returns to a clean aggregate setup after the scope is cleared', () => {
    const reset = portfolioReducer(createPortfolioState(readyWithPlan), {
      type: 'reset-confirmed', now: 3,
    });
    expect(reset.applied).toBeNull();
    expect(reset.draft).toEqual(createCashOnlyDraft(200_000, 3));
    expect(reset.draft.scope).toEqual({ type: 'aggregate' });
    expect(reset.view).toBe('setup');
    expect(reset.setupStep).toBe('welcome');
    expect(reset.dirty).toBe(false);
  });

  it('opening edit and changing only the input mode do not dirty allocation', () => {
    const opened = portfolioReducer(createPortfolioState(readyWithPlan), { type: 'edit-opened' });
    const switched = portfolioReducer(opened, { type: 'input-mode-changed', mode: 'percentage' });
    expect(switched.view).toBe('edit');
    expect(switched.setupStep).toBeNull();
    expect(switched.dirty).toBe(false);
  });

  it('recommends again on automatic renames but preserves a user classification until automatic is restored', () => {
    let state = createPortfolioState(readyWithPlan);

    state = portfolioReducer(state, { type: 'draft-name-changed', id: 'a', name: '국채 ETF', now: 2 });
    expect(state.draft.items[0]).toMatchObject({ classification: 'stable', classificationOrigin: 'automatic' });

    state = portfolioReducer(state, {
      type: 'draft-classification-changed', id: 'a', classification: 'growth', now: 3,
    });
    state = portfolioReducer(state, { type: 'draft-name-changed', id: 'a', name: '금현물', now: 4 });
    expect(state.draft.items[0]).toMatchObject({ classification: 'growth', classificationOrigin: 'user' });

    state = portfolioReducer(state, { type: 'draft-classification-auto-enabled', id: 'a', now: 5 });
    expect(state.draft.items[0]).toMatchObject({ classification: 'stable', classificationOrigin: 'automatic' });
  });

  it('commits a complete new target in one reducer action', () => {
    const state = createPortfolioState(readyWithoutPlan);
    const committed = portfolioReducer(state, {
      type: 'draft-item-committed',
      item: { id: 'bond', name: '국채 ETF', order: 0 },
      amountWon: 50_000,
      classification: 'stable',
      classificationOrigin: 'automatic',
      now: 3,
    });

    expect(committed.draft.items).toHaveLength(1);
    expect(committed.draft.items[0]).toMatchObject({
      id: 'bond', name: '국채 ETF', order: 0,
      classification: 'stable', classificationOrigin: 'automatic',
    });
    expect(materializeAllocation(committed.draft, 200_000).items[0].amountWon).toBe(50_000);
  });

  it('commits an existing target without changing its count or order', () => {
    const state = createPortfolioState(readyWithPlan);
    const committed = portfolioReducer(state, {
      type: 'draft-item-committed',
      item: { id: 'a', name: '미국 성장주', order: 0 },
      amountWon: 125_000,
      classification: 'stable',
      classificationOrigin: 'user',
      now: 3,
    });

    expect(committed.draft.items).toHaveLength(1);
    expect(committed.draft.items[0]).toMatchObject({
      id: 'a', name: '미국 성장주', order: 0,
      classification: 'stable', classificationOrigin: 'user',
    });
    expect(materializeAllocation(committed.draft, 200_000).items[0].amountWon).toBe(125_000);
  });
});
