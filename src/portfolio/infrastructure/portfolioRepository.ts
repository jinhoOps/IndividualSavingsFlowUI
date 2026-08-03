import type { PortfolioDraft, PortfolioPlan } from '../domain/model';
import { parsePortfolioDraft, parsePortfolioPlan } from '../domain/validation';

export const PORTFOLIO_APPLIED_KEY = 'isf-portfolio-allocation-v1';
export const PORTFOLIO_DRAFT_KEY = 'isf-portfolio-allocation-draft-v1';

export type PortfolioAppliedLoadResult =
  | { status: 'found'; plan: PortfolioPlan }
  | { status: 'empty' | 'invalid' | 'unavailable' };
export type PortfolioDraftLoadResult =
  | { status: 'found'; draft: PortfolioDraft }
  | { status: 'empty' | 'invalid' | 'unavailable' };
export interface PortfolioStorageLoadResult {
  applied: PortfolioAppliedLoadResult;
  draft: PortfolioDraftLoadResult;
}
export type PortfolioWriteResult = { status: 'saved' } | { status: 'unavailable' };

export interface PortfolioRepository {
  load(): PortfolioStorageLoadResult;
  saveApplied(plan: PortfolioPlan): PortfolioWriteResult;
  saveDraft(draft: PortfolioDraft): PortfolioWriteResult;
  clearDraft(): PortfolioWriteResult;
  clearAll(): PortfolioWriteResult;
}

export class BrowserPortfolioRepository implements PortfolioRepository {
  constructor(private readonly getStorage: () => Storage = () => window.localStorage) {}

  load(): PortfolioStorageLoadResult {
    let storage: Storage;
    try {
      storage = this.getStorage();
    } catch {
      return { applied: { status: 'unavailable' }, draft: { status: 'unavailable' } };
    }
    return {
      applied: loadValue(storage, PORTFOLIO_APPLIED_KEY, parsePortfolioPlan, 'plan'),
      draft: loadValue(storage, PORTFOLIO_DRAFT_KEY, parsePortfolioDraft, 'draft'),
    };
  }

  saveApplied(plan: PortfolioPlan): PortfolioWriteResult {
    return this.write(() => this.getStorage().setItem(PORTFOLIO_APPLIED_KEY, JSON.stringify(plan)));
  }

  saveDraft(draft: PortfolioDraft): PortfolioWriteResult {
    return this.write(() => this.getStorage().setItem(PORTFOLIO_DRAFT_KEY, JSON.stringify(draft)));
  }

  clearDraft(): PortfolioWriteResult {
    return this.write(() => this.getStorage().removeItem(PORTFOLIO_DRAFT_KEY));
  }

  clearAll(): PortfolioWriteResult {
    return this.write(() => {
      const storage = this.getStorage();
      storage.removeItem(PORTFOLIO_APPLIED_KEY);
      storage.removeItem(PORTFOLIO_DRAFT_KEY);
    });
  }

  private write(action: () => void): PortfolioWriteResult {
    try {
      action();
      return { status: 'saved' };
    } catch {
      return { status: 'unavailable' };
    }
  }
}

function loadValue<T, K extends 'plan' | 'draft'>(
  storage: Storage,
  key: string,
  parser: (value: unknown) => T | null,
  resultKey: K,
): ({ status: 'found' } & Record<K, T>) | { status: 'empty' | 'invalid' | 'unavailable' } {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { status: 'empty' };
    const parsed = parser(JSON.parse(raw));
    return parsed === null
      ? { status: 'invalid' }
      : { status: 'found', [resultKey]: parsed } as { status: 'found' } & Record<K, T>;
  } catch (error) {
    return error instanceof SyntaxError ? { status: 'invalid' } : { status: 'unavailable' };
  }
}
