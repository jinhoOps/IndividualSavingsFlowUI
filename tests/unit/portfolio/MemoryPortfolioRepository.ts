import type { PortfolioDraft, PortfolioPlan } from '../../../src/portfolio/domain/model';
import type {
  PortfolioRepository,
  PortfolioStorageLoadResult,
  PortfolioWriteResult,
} from '../../../src/portfolio/infrastructure/portfolioRepository';

export interface MemoryPortfolioRepository extends PortfolioRepository {
  applied: PortfolioPlan | null;
  draft: PortfolioDraft | null;
  failNextWrite(): void;
}

export function createMemoryPortfolioRepository(initial: {
  applied?: PortfolioPlan;
  draft?: PortfolioDraft;
} = {}): MemoryPortfolioRepository {
  let shouldFail = false;
  const repository: MemoryPortfolioRepository = {
    applied: initial.applied ?? null,
    draft: initial.draft ?? null,
    load(): PortfolioStorageLoadResult {
      return {
        applied: this.applied === null ? { status: 'empty' } : { status: 'found', plan: this.applied },
        draft: this.draft === null ? { status: 'empty' } : { status: 'found', draft: this.draft },
      };
    },
    saveApplied(plan): PortfolioWriteResult {
      if (consumeFailure()) return { status: 'unavailable' };
      this.applied = plan;
      return { status: 'saved' };
    },
    saveDraft(draft): PortfolioWriteResult {
      if (consumeFailure()) return { status: 'unavailable' };
      this.draft = draft;
      return { status: 'saved' };
    },
    clearDraft(): PortfolioWriteResult {
      if (consumeFailure()) return { status: 'unavailable' };
      this.draft = null;
      return { status: 'saved' };
    },
    clearAll(): PortfolioWriteResult {
      if (consumeFailure()) return { status: 'unavailable' };
      this.applied = null;
      this.draft = null;
      return { status: 'saved' };
    },
    failNextWrite(): void {
      shouldFail = true;
    },
  };
  return repository;

  function consumeFailure(): boolean {
    if (!shouldFail) return false;
    shouldFail = false;
    return true;
  }
}
