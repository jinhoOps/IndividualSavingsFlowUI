import {
  BrowserWorkspaceRepository,
  type WorkspaceLoadResult,
  type WorkspaceRepository,
} from '../../workspace/infrastructure/workspaceRepository';
import {
  scopeKey,
  type PortfolioDraft,
  type PortfolioPlan,
  type PortfolioScope,
} from '../domain/model';
import { parsePortfolioDraft, parsePortfolioPlan } from '../domain/validation';

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
  saveApplied(plan: PortfolioPlan): Promise<PortfolioWriteResult>;
  saveDraft(draft: PortfolioDraft): Promise<PortfolioWriteResult>;
  clearDraft(): Promise<PortfolioWriteResult>;
  clearScope(scope: PortfolioScope): Promise<PortfolioWriteResult>;
}

export class BrowserPortfolioRepository implements PortfolioRepository {
  private planBases: Map<string, PortfolioPlan> | typeof untrackedBase = untrackedBase;
  private draftBase: PortfolioDraft | null | typeof untrackedBase = untrackedBase;

  constructor(
    private readonly workspaceRepository: WorkspaceRepository = new BrowserWorkspaceRepository(),
  ) {}

  load(): PortfolioStorageLoadResult {
    const loaded = this.workspaceRepository.load();
    if (loaded.status === 'invalid' || loaded.status === 'unavailable') {
      this.planBases = untrackedBase;
      this.draftBase = untrackedBase;
      return {
        applied: { status: loaded.status },
        draft: { status: loaded.status },
      };
    }

    this.planBases = new Map(loaded.workspace.portfolio.plans.map((plan) => [
      scopeKey(plan.scope),
      structuredClone(plan),
    ]));
    this.draftBase = cloneDraft(loaded.workspace.portfolio.draft);
    const aggregatePlan = loaded.workspace.portfolio.plans.find(isAggregate);
    const aggregateDraft = loaded.workspace.portfolio.draft?.scope.type === 'aggregate'
      ? loaded.workspace.portfolio.draft
      : null;
    return {
      applied: aggregatePlan === undefined
        ? { status: 'empty' }
        : { status: 'found', plan: structuredClone(aggregatePlan) },
      draft: aggregateDraft === null
        ? { status: 'empty' }
        : { status: 'found', draft: structuredClone(aggregateDraft) },
    };
  }

  async saveApplied(plan: PortfolioPlan): Promise<PortfolioWriteResult> {
    const parsed = parsePortfolioPlan(plan);
    if (parsed === null || this.planBases === untrackedBase) return unavailable();
    const key = scopeKey(parsed.scope);
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (loaded === null
      || !samePlan(findPlan(loaded.workspace.portfolio.plans, key), this.planBases.get(key) ?? null)) {
      return unavailable();
    }
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => ({
        ...current,
        portfolio: {
          ...current.portfolio,
          plans: upsertPlan(current.portfolio.plans, parsed),
        },
      }),
    );
    if (result.status !== 'saved') return unavailable();
    const saved = findPlan(result.workspace.portfolio.plans, key);
    if (saved === null) return unavailable();
    this.planBases.set(key, structuredClone(saved));
    return { status: 'saved' };
  }

  async saveDraft(draft: PortfolioDraft): Promise<PortfolioWriteResult> {
    const parsed = parsePortfolioDraft(draft);
    if (parsed === null || this.draftBase === untrackedBase) return unavailable();
    if (this.draftBase !== null && scopeKey(this.draftBase.scope) !== scopeKey(parsed.scope)) {
      return unavailable();
    }
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (loaded === null || !sameDraft(loaded.workspace.portfolio.draft, this.draftBase)) {
      return unavailable();
    }
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => ({
        ...current,
        portfolio: { ...current.portfolio, draft: structuredClone(parsed) },
      }),
    );
    if (result.status !== 'saved') return unavailable();
    this.draftBase = cloneDraft(result.workspace.portfolio.draft);
    return { status: 'saved' };
  }

  async clearDraft(): Promise<PortfolioWriteResult> {
    if (this.draftBase === untrackedBase) return unavailable();
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (loaded === null || !sameDraft(loaded.workspace.portfolio.draft, this.draftBase)) {
      return unavailable();
    }
    if (this.draftBase === null || this.draftBase.scope.type !== 'aggregate') {
      return { status: 'saved' };
    }
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => ({
        ...current,
        portfolio: { ...current.portfolio, draft: null },
      }),
    );
    if (result.status !== 'saved') return unavailable();
    this.draftBase = null;
    return { status: 'saved' };
  }

  async clearScope(scope: PortfolioScope): Promise<PortfolioWriteResult> {
    if (this.planBases === untrackedBase || this.draftBase === untrackedBase) return unavailable();
    const key = scopeKey(scope);
    const loaded = loadWritableWorkspace(this.workspaceRepository);
    if (loaded === null
      || !samePlan(findPlan(loaded.workspace.portfolio.plans, key), this.planBases.get(key) ?? null)
      || !sameDraft(
        draftForScope(loaded.workspace.portfolio.draft, key),
        draftForScope(this.draftBase, key),
      )) {
      return unavailable();
    }
    const hasPlan = findPlan(loaded.workspace.portfolio.plans, key) !== null;
    const hasDraft = draftForScope(loaded.workspace.portfolio.draft, key) !== null;
    if (!hasPlan && !hasDraft) return { status: 'saved' };
    const result = await this.workspaceRepository.update(
      loaded.workspace.revision,
      (current) => ({
        ...current,
        portfolio: {
          plans: current.portfolio.plans.filter((plan) => scopeKey(plan.scope) !== key),
          draft: draftForScope(current.portfolio.draft, key) === null
            ? current.portfolio.draft
            : null,
        },
      }),
    );
    if (result.status !== 'saved') return unavailable();
    this.planBases.delete(key);
    if (draftForScope(this.draftBase, key) !== null) this.draftBase = null;
    return { status: 'saved' };
  }
}

const untrackedBase = Symbol('untracked Portfolio workspace slice');

function loadWritableWorkspace(repository: WorkspaceRepository): Extract<WorkspaceLoadResult, {
  status: 'found' | 'empty';
}> | null {
  const loaded = repository.load();
  return loaded.status === 'found' || loaded.status === 'empty' ? loaded : null;
}

function upsertPlan(plans: PortfolioPlan[], plan: PortfolioPlan): PortfolioPlan[] {
  const key = scopeKey(plan.scope);
  const index = plans.findIndex((candidate) => scopeKey(candidate.scope) === key);
  if (index < 0) return [...plans, structuredClone(plan)];
  return plans.map((candidate, candidateIndex) => (
    candidateIndex === index ? structuredClone(plan) : candidate
  ));
}

function findPlan(plans: PortfolioPlan[], key: string): PortfolioPlan | null {
  return plans.find((plan) => scopeKey(plan.scope) === key) ?? null;
}

function draftForScope(draft: PortfolioDraft | null, key: string): PortfolioDraft | null {
  return draft !== null && scopeKey(draft.scope) === key ? draft : null;
}

function isAggregate(plan: PortfolioPlan): boolean {
  return plan.scope.type === 'aggregate';
}

function cloneDraft(draft: PortfolioDraft | null): PortfolioDraft | null {
  return draft === null ? null : structuredClone(draft);
}

function samePlan(left: PortfolioPlan | null, right: PortfolioPlan | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameDraft(left: PortfolioDraft | null, right: PortfolioDraft | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function unavailable(): PortfolioWriteResult {
  return { status: 'unavailable' };
}
