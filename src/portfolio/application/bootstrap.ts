import { createCashOnlyDraft, syncPlanToInvestment } from '../domain/allocation';
import type { PortfolioDraft, PortfolioPlan } from '../domain/model';
import type { PortfolioMainSourceLoadResult } from '../infrastructure/mainSourceRepository';
import type { PortfolioStorageLoadResult } from '../infrastructure/portfolioRepository';

export type PortfolioBootstrapResult =
  | {
    kind: 'ready';
    plan: PortfolioPlan | null;
    draft: PortfolioDraft;
    shouldPersistApplied: boolean;
    shouldPersistDraft: boolean;
    persistenceAvailable: boolean;
  }
  | { kind: 'investment-required'; preservedPlan: PortfolioPlan | null; reason: 'zero-investment' }
  | { kind: 'stale-main'; plan: PortfolioPlan; draft: PortfolioDraft | null; persistenceAvailable: boolean }
  | { kind: 'main-required'; reason: 'empty' | 'invalid' | 'unavailable' };

export function bootstrapPortfolio(
  mainResult: PortfolioMainSourceLoadResult,
  storageResult: PortfolioStorageLoadResult,
  now: number = Date.now(),
): PortfolioBootstrapResult {
  const loadedPlan = storageResult.applied.status === 'found' ? storageResult.applied.plan : null;
  const loadedDraft = storageResult.draft.status === 'found' ? storageResult.draft.draft : null;
  const persistenceAvailable = storageResult.applied.status !== 'unavailable'
    && storageResult.draft.status !== 'unavailable';

  if (mainResult.status === 'unavailable' && loadedPlan !== null) {
    return { kind: 'stale-main', plan: loadedPlan, draft: loadedDraft, persistenceAvailable };
  }
  if (mainResult.status !== 'found') return { kind: 'main-required', reason: mainResult.status };
  const investmentWon = mainResult.source.monthlyInvestmentWon;
  if (investmentWon === 0) {
    return { kind: 'investment-required', preservedPlan: loadedPlan, reason: 'zero-investment' };
  }

  const shouldPersistApplied = loadedPlan !== null && loadedPlan.syncedInvestmentWon !== investmentWon;
  const plan = loadedPlan === null
    ? null
    : shouldPersistApplied
      ? syncPlanToInvestment(loadedPlan, investmentWon, now)
      : loadedPlan;
  const usableLoadedDraft = loadedDraft !== null
    && (loadedPlan === null || loadedDraft.updatedAt > loadedPlan.updatedAt)
    ? loadedDraft
    : null;
  const baseDraft = usableLoadedDraft ?? (plan === null ? createCashOnlyDraft(investmentWon, now) : draftFromPlan(plan));
  const shouldAdvanceDirtyDraft = usableLoadedDraft !== null && shouldPersistApplied;
  const draft = baseDraft.syncedInvestmentWon === investmentWon && !shouldAdvanceDirtyDraft
    ? baseDraft
    : syncPlanToInvestment(baseDraft, investmentWon, usableLoadedDraft === null ? now : now + 1);
  const shouldPersistDraft = usableLoadedDraft !== null && draft !== loadedDraft;
  return { kind: 'ready', plan, draft, shouldPersistApplied, shouldPersistDraft, persistenceAvailable };
}

export function draftFromPlan(plan: PortfolioPlan): PortfolioDraft {
  return {
    schemaVersion: plan.schemaVersion,
    scope: { ...plan.scope },
    items: plan.items.map((item) => ({ ...item })),
    cashShareUnits: plan.cashShareUnits,
    cashMode: plan.cashMode,
    inputMode: 'amount',
    syncedInvestmentWon: plan.syncedInvestmentWon,
    updatedAt: plan.updatedAt,
    isApplicable: true,
  };
}
