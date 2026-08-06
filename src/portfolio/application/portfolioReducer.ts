import { draftFromPlan, type PortfolioBootstrapResult } from './bootstrap';
import {
  createCashOnlyDraft,
  enableAutomaticCash,
  removeItem,
  setCashAmount,
  setItemAmount,
  setItemPercentage,
} from '../domain/allocation';
import type {
  InputMode,
  PortfolioDraft,
  PortfolioItemIdentity,
  PortfolioPlan,
} from '../domain/model';

export interface PortfolioState {
  view: 'result' | 'edit';
  applied: PortfolioPlan | null;
  draft: PortfolioDraft;
  dirty: boolean;
  saveState: 'saved' | 'saving' | 'error' | 'cleanup-error';
  fieldError: string | null;
}

export type PortfolioAction =
  | { type: 'edit-opened' }
  | { type: 'draft-name-changed'; id: string; name: string; now: number }
  | { type: 'draft-item-added'; item: PortfolioItemIdentity; now: number }
  | { type: 'draft-item-removed'; id: string; now: number }
  | { type: 'draft-item-amount-changed'; id: string; amountWon: number; now: number }
  | { type: 'draft-item-percentage-changed'; id: string; percentage: number; now: number }
  | { type: 'draft-cash-changed'; amountWon: number; now: number }
  | { type: 'automatic-cash-enabled'; now: number }
  | { type: 'input-mode-changed'; mode: InputMode }
  | { type: 'cancel-edit' }
  | { type: 'apply-started' }
  | { type: 'apply-succeeded'; plan: PortfolioPlan }
  | { type: 'save-failed' }
  | { type: 'draft-cleanup-failed' }
  | { type: 'reset-confirmed'; now: number };

type ReadyBootstrap = Extract<PortfolioBootstrapResult, { kind: 'ready' }>;

export function createPortfolioState(result: ReadyBootstrap): PortfolioState {
  const dirty = result.plan === null
    ? !isCashOnly(result.draft)
    : !sameAllocation(result.draft, result.plan);
  return {
    view: result.plan === null || dirty ? 'edit' : 'result',
    applied: result.plan,
    draft: result.draft,
    dirty,
    saveState: result.persistenceAvailable ? 'saved' : 'error',
    fieldError: null,
  };
}

export function portfolioReducer(state: PortfolioState, action: PortfolioAction): PortfolioState {
  switch (action.type) {
    case 'edit-opened':
      return { ...state, view: 'edit', fieldError: null };
    case 'input-mode-changed':
      return { ...state, draft: { ...state.draft, inputMode: action.mode }, fieldError: null };
    case 'draft-name-changed':
      return updateDraft(state, {
        ...state.draft,
        items: state.draft.items.map((item) => item.id === action.id ? { ...item, name: action.name } : item),
        updatedAt: action.now,
      });
    case 'draft-item-added':
      return tryDraft(state, action.now, (draft) => setItemAmount(draft, action.item, 0));
    case 'draft-item-removed':
      return updateDraft(state, { ...removeItem(state.draft, action.id), updatedAt: action.now });
    case 'draft-item-amount-changed': {
      const item = requireItem(state.draft, action.id);
      return tryDraft(state, action.now, (draft) => setItemAmount(draft, item, action.amountWon));
    }
    case 'draft-item-percentage-changed': {
      const item = requireItem(state.draft, action.id);
      return tryDraft(state, action.now, (draft) => setItemPercentage(draft, item, action.percentage));
    }
    case 'draft-cash-changed':
      return tryDraft(state, action.now, (draft) => setCashAmount(draft, action.amountWon));
    case 'automatic-cash-enabled':
      return updateDraft(state, { ...enableAutomaticCash(state.draft), updatedAt: action.now });
    case 'cancel-edit': {
      if (state.applied === null) {
        const draft = createCashOnlyDraft(state.draft.syncedInvestmentWon, state.draft.updatedAt);
        return { ...state, draft, dirty: false, fieldError: null };
      }
      return {
        ...state,
        view: 'result',
        draft: draftFromPlan(state.applied),
        dirty: false,
        fieldError: null,
      };
    }
    case 'apply-started':
      return { ...state, saveState: 'saving', fieldError: null };
    case 'apply-succeeded':
      return {
        ...state,
        view: 'result',
        applied: action.plan,
        draft: draftFromPlan(action.plan),
        dirty: false,
        saveState: 'saved',
        fieldError: null,
      };
    case 'save-failed':
      return { ...state, saveState: 'error' };
    case 'draft-cleanup-failed':
      return { ...state, saveState: 'cleanup-error' };
    case 'reset-confirmed': {
      const draft = createCashOnlyDraft(state.draft.syncedInvestmentWon, action.now);
      const plan = planFromDraft(draft, action.now);
      return {
        ...state,
        view: 'result',
        applied: plan,
        draft: draftFromPlan(plan),
        dirty: false,
        saveState: 'saved',
        fieldError: null,
      };
    }
  }
}

export function planFromDraft(draft: PortfolioDraft, now: number): PortfolioPlan {
  return {
    schemaVersion: draft.schemaVersion,
    scope: { ...draft.scope },
    items: draft.items.map((item) => ({ ...item })),
    cashShareUnits: draft.cashShareUnits,
    cashMode: draft.cashMode,
    syncedInvestmentWon: draft.syncedInvestmentWon,
    appliedAt: now,
    updatedAt: now,
  };
}

function tryDraft(
  state: PortfolioState,
  now: number,
  change: (draft: PortfolioDraft) => PortfolioDraft,
): PortfolioState {
  try {
    return updateDraft(state, { ...change(state.draft), updatedAt: now });
  } catch (error) {
    return { ...state, fieldError: error instanceof Error ? error.message : 'invalid-allocation' };
  }
}

function updateDraft(state: PortfolioState, draft: PortfolioDraft): PortfolioState {
  return {
    ...state,
    draft,
    dirty: state.applied === null ? !isCashOnly(draft) : !sameAllocation(draft, state.applied),
    fieldError: null,
  };
}

function requireItem(draft: PortfolioDraft, id: string): PortfolioItemIdentity {
  const item = draft.items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error('item-not-found');
  return { id: item.id, name: item.name, order: item.order };
}

function sameAllocation(draft: PortfolioDraft, plan: PortfolioPlan): boolean {
  return draft.cashMode === plan.cashMode
    && draft.cashShareUnits === plan.cashShareUnits
    && draft.syncedInvestmentWon === plan.syncedInvestmentWon
    && JSON.stringify(draft.items) === JSON.stringify(plan.items);
}

function isCashOnly(draft: PortfolioDraft): boolean {
  return draft.items.length === 0 && draft.cashShareUnits === 1_000_000;
}
