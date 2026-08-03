import {
  PORTFOLIO_SCHEMA_VERSION,
  SHARE_SCALE,
  type MaterializedAllocation,
  type PortfolioDraft,
  type PortfolioItem,
  type PortfolioItemIdentity,
  type PortfolioPlan,
} from './model';

export function createCashOnlyDraft(investmentWon: number, now: number): PortfolioDraft {
  assertNonnegativeSafeInteger(investmentWon, 'invalid-investment');
  return {
    schemaVersion: PORTFOLIO_SCHEMA_VERSION,
    items: [],
    cashShareUnits: SHARE_SCALE,
    cashMode: 'automatic',
    inputMode: 'amount',
    syncedInvestmentWon: investmentWon,
    updatedAt: now,
    isApplicable: investmentWon > 0,
  };
}

export function normalizePortfolioName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

export function setItemAmount(
  draft: PortfolioDraft,
  identity: PortfolioItemIdentity,
  amountWon: number,
): PortfolioDraft {
  assertAllocationAmount(amountWon);
  if (draft.syncedInvestmentWon <= 0) throw new Error('invalid-investment');
  const amounts = itemAmounts(draft);
  amounts.set(identity.id, amountWon);
  if (sum(amounts.values()) > draft.syncedInvestmentWon) {
    throw new Error('allocation-exceeds-investment');
  }
  return rebuildItems(draft, identity, amounts);
}

export function setItemPercentage(
  draft: PortfolioDraft,
  identity: PortfolioItemIdentity,
  percentage: number,
): PortfolioDraft {
  if (!Number.isFinite(percentage)
    || percentage < 0
    || percentage > 100
    || !Number.isInteger(percentage * 10)) {
    throw new Error('invalid-percentage');
  }
  const amountWon = Math.round(draft.syncedInvestmentWon * percentage / 100);
  return setItemAmount(draft, identity, amountWon);
}

export function setCashAmount(draft: PortfolioDraft, amountWon: number): PortfolioDraft {
  assertNonnegativeSafeInteger(amountWon, 'invalid-cash');
  const cashShareUnits = amountToShare(amountWon, draft.syncedInvestmentWon);
  const itemShareUnits = sum(draft.items.map((item) => item.shareUnits));
  if (itemShareUnits + cashShareUnits > SHARE_SCALE) {
    throw new Error('allocation-exceeds-investment');
  }
  return withApplicability({
    ...draft,
    cashMode: 'manual',
    cashShareUnits,
  });
}

export function enableAutomaticCash(draft: PortfolioDraft): PortfolioDraft {
  return withApplicability({
    ...draft,
    cashMode: 'automatic',
    cashShareUnits: SHARE_SCALE - sum(draft.items.map((item) => item.shareUnits)),
  });
}

export function removeItem(draft: PortfolioDraft, id: string): PortfolioDraft {
  const removed = draft.items.find((item) => item.id === id);
  if (removed === undefined) return draft;
  const items = draft.items.filter((item) => item.id !== id);
  const next = {
    ...draft,
    items,
    cashShareUnits: draft.cashMode === 'manual'
      ? draft.cashShareUnits + removed.shareUnits
      : SHARE_SCALE - sum(items.map((item) => item.shareUnits)),
  };
  return withApplicability(next);
}

export function syncPlanToInvestment<T extends PortfolioPlan | PortfolioDraft>(
  value: T,
  nextInvestmentWon: number,
  now: number,
): T {
  assertNonnegativeSafeInteger(nextInvestmentWon, 'invalid-investment');
  const previous = value.syncedInvestmentWon;
  if (previous === nextInvestmentWon) return { ...value, updatedAt: now };
  if (previous <= 0 || nextInvestmentWon <= previous) {
    return withSyncedApplicability({
      ...value,
      syncedInvestmentWon: nextInvestmentWon,
      updatedAt: now,
    });
  }

  const previousAmounts = materializeAllocation(value, previous);
  const items = value.items.map((item) => {
    const amountWon = previousAmounts.items.find((candidate) => candidate.id === item.id)?.amountWon ?? 0;
    return { ...item, shareUnits: amountToShare(amountWon, nextInvestmentWon) };
  });
  const cashShareUnits = SHARE_SCALE - sum(items.map((item) => item.shareUnits));
  return withSyncedApplicability({
    ...value,
    items,
    cashShareUnits,
    syncedInvestmentWon: nextInvestmentWon,
    updatedAt: now,
  });
}

export function materializeAllocation(
  value: PortfolioPlan | PortfolioDraft,
  investmentWon: number,
): MaterializedAllocation {
  assertNonnegativeSafeInteger(investmentWon, 'invalid-investment');
  const items = value.items.map((item) => ({
    ...item,
    amountWon: Math.round(investmentWon * item.shareUnits / SHARE_SCALE),
    percentage: item.shareUnits / 10_000,
  }));
  const itemTotal = sum(items.map((item) => item.amountWon));
  const cashAmountWon = value.cashMode === 'automatic'
    ? investmentWon - itemTotal
    : Math.round(investmentWon * value.cashShareUnits / SHARE_SCALE);
  return {
    items,
    cashAmountWon,
    cashPercentage: value.cashShareUnits / 10_000,
    totalAmountWon: itemTotal + cashAmountWon,
  };
}

export function sortResultItems<T extends { amountWon: number; id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => right.amountWon - left.amountWon || left.id.localeCompare(right.id));
}

function rebuildItems(
  draft: PortfolioDraft,
  identity: PortfolioItemIdentity,
  amounts: Map<string, number>,
): PortfolioDraft {
  const existing = draft.items.find((item) => item.id === identity.id);
  const baseItems = existing === undefined
    ? [...draft.items, { ...identity, shareUnits: 0 }]
    : draft.items.map((item) => item.id === identity.id ? { ...item, ...identity } : item);
  if (baseItems.length > 10) throw new Error('too-many-items');
  const items = baseItems.map((item) => ({
    ...item,
    shareUnits: amountToShare(amounts.get(item.id) ?? 0, draft.syncedInvestmentWon),
  }));
  const itemShareUnits = sum(items.map((item) => item.shareUnits));
  const cashShareUnits = draft.cashMode === 'automatic'
    ? SHARE_SCALE - itemShareUnits
    : draft.cashShareUnits;
  if (itemShareUnits + cashShareUnits > SHARE_SCALE) {
    throw new Error('allocation-exceeds-investment');
  }
  return withApplicability({ ...draft, items, cashShareUnits });
}

function itemAmounts(value: PortfolioDraft): Map<string, number> {
  return new Map(materializeAllocation(value, value.syncedInvestmentWon).items
    .map((item) => [item.id, item.amountWon]));
}

function amountToShare(amountWon: number, investmentWon: number): number {
  if (investmentWon === 0) return 0;
  return Math.round(amountWon * SHARE_SCALE / investmentWon);
}

function withApplicability(draft: PortfolioDraft): PortfolioDraft {
  const total = sum(draft.items.map((item) => item.shareUnits)) + draft.cashShareUnits;
  return { ...draft, isApplicable: draft.syncedInvestmentWon > 0 && total === SHARE_SCALE };
}

function withSyncedApplicability<T extends PortfolioPlan | PortfolioDraft>(value: T): T {
  if ('isApplicable' in value) return withApplicability(value) as T;
  return value;
}

function assertAllocationAmount(value: number): void {
  assertNonnegativeSafeInteger(value, 'invalid-amount');
  if (value > 0 && value < 1_000) throw new Error('amount-below-minimum');
}

function assertNonnegativeSafeInteger(value: number, code: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(code);
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}
