import { describe, expect, it, vi } from 'vitest';
import { createCashOnlyDraft } from '../../../src/portfolio/domain/allocation';
import type { PortfolioPlan, PortfolioScope } from '../../../src/portfolio/domain/model';
import { BrowserPortfolioRepository } from '../../../src/portfolio/infrastructure/portfolioRepository';
import { WORKSPACE_STORAGE_KEY, type WorkspaceDocument } from '../../../src/workspace/domain/model';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../../src/workspace/infrastructure/workspaceRepository';

const oldAppliedKey = 'isf-portfolio-allocation-v1';
const oldDraftKey = 'isf-portfolio-allocation-draft-v1';
const aggregatePlan: PortfolioPlan = {
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

class TrackingStorage implements Storage {
  readonly reads: string[] = [];
  readonly writes: string[] = [];
  constructor(private readonly values = new Map<string, string>()) {}
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null {
    this.reads.push(key);
    return this.values.get(key) ?? null;
  }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.writes.push(key); this.values.delete(key); }
  setItem(key: string, value: string): void { this.writes.push(key); this.values.set(key, value); }
  resetLog(): void { this.reads.length = 0; this.writes.length = 0; }
}

function serialLock() {
  return {
    async runExclusive<T>(task: (guard: { assertOwned(): void }) => T | Promise<T>): Promise<T> {
      return await task({ assertOwned: () => undefined });
    },
  };
}

function workspace(overrides: Partial<WorkspaceDocument['portfolio']> = {}): WorkspaceDocument {
  return {
    schemaVersion: 3,
    revision: 4,
    updatedAt: 400,
    main: {
      applied: {
        schemaVersion: 2,
        updatedAt: 100,
        monthlyNetIncomeWon: 4_000_000,
        monthlyHousingWon: 900_000,
        monthlyLivingWon: 1_000_000,
        monthlySavingWon: 300_000,
        monthlyInvestmentWon: 200_000,
      },
      setupProgress: null,
    },
    simulation: { draft: null },
    portfolio: {
      plans: [aggregatePlan],
      draft: { ...createCashOnlyDraft(200_000, 3), updatedAt: 3 },
      ...overrides,
    },
    locations: [],
    accountMap: { applied: null, draft: null },
  };
}

function browserRepository(storage: Storage, now = 500) {
  return new BrowserPortfolioRepository(new BrowserWorkspaceRepository(storage, {
    now: () => now,
    saveLock: serialLock(),
  }));
}

function readWorkspace(storage: Storage): WorkspaceDocument {
  return JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
}

describe('BrowserPortfolioRepository workspace adapter', () => {
  it('starts empty without reading or changing retired standalone keys', () => {
    const oldApplied = JSON.stringify({ schemaVersion: 1, items: aggregatePlan.items });
    const oldDraft = '{old-draft';
    const storage = new TrackingStorage(new Map([
      [oldAppliedKey, oldApplied],
      [oldDraftKey, oldDraft],
    ]));

    expect(browserRepository(storage).load()).toEqual({
      applied: { status: 'empty' },
      draft: { status: 'empty' },
    });
    expect(storage.reads).toEqual([WORKSPACE_STORAGE_KEY]);
    expect(storage.writes).toEqual([]);
    expect(storage.getItem(oldAppliedKey)).toBe(oldApplied);
    expect(storage.getItem(oldDraftKey)).toBe(oldDraft);
  });

  it('loads the aggregate plan and draft', () => {
    const saved = workspace();
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    expect(browserRepository(storage).load()).toEqual({
      applied: { status: 'found', plan: aggregatePlan },
      draft: { status: 'found', draft: saved.portfolio.draft },
    });
  });

  it('upserts one aggregate plan revision and preserves every other slice', async () => {
    const saved = workspace();
    const oldApplied = '{old-applied';
    const oldDraft = '{old-draft';
    const storage = new TrackingStorage(new Map([
      [WORKSPACE_STORAGE_KEY, JSON.stringify(saved)],
      [oldAppliedKey, oldApplied],
      [oldDraftKey, oldDraft],
    ]));
    const repository = browserRepository(storage, 600);
    repository.load();
    const nextPlan = {
      ...aggregatePlan,
      cashShareUnits: 500_000,
      items: [{ ...aggregatePlan.items[0]!, shareUnits: 500_000 }],
      updatedAt: 5,
    };
    storage.resetLog();

    await expect(repository.saveApplied(nextPlan)).resolves.toEqual({ status: 'saved' });

    const next = readWorkspace(storage);
    expect(next).toMatchObject({ revision: 5, updatedAt: 600 });
    expect(next.portfolio).toEqual({ plans: [nextPlan], draft: saved.portfolio.draft });
    for (const slice of ['main', 'simulation', 'locations', 'accountMap'] as const) {
      expect(next[slice]).toEqual(saved[slice]);
    }
    expect(storage.reads.filter((key) => key === oldAppliedKey || key === oldDraftKey)).toEqual([]);
    expect(storage.writes.filter((key) => key === oldAppliedKey || key === oldDraftKey)).toEqual([]);
  });

  it('saves and clears the single aggregate draft', async () => {
    const saved = workspace({ draft: null });
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();
    const nextDraft = {
      ...createCashOnlyDraft(200_000, 5),
      items: [{
        id: 'new', name: '성장', shareUnits: 250_000, order: 0,
        classification: 'growth' as const, classificationOrigin: 'automatic' as const,
      }],
      cashShareUnits: 750_000,
    };

    await expect(repository.saveDraft(nextDraft)).resolves.toEqual({ status: 'saved' });
    expect(readWorkspace(storage).portfolio).toEqual({ plans: [aggregatePlan], draft: nextDraft });
    await expect(repository.clearDraft()).resolves.toEqual({ status: 'saved' });
    expect(readWorkspace(storage).portfolio).toEqual({ plans: [aggregatePlan], draft: null });
  });

  it('clearScope removes the aggregate plan and draft together', async () => {
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(workspace())]]));
    const repository = browserRepository(storage, 600);
    repository.load();

    await expect(repository.clearScope({ type: 'aggregate' })).resolves.toEqual({ status: 'saved' });
    expect(readWorkspace(storage).portfolio).toEqual({ plans: [], draft: null });
  });

  it('rejects a stale aggregate base without overwriting its winner', async () => {
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(workspace())]]));
    const first = browserRepository(storage, 600);
    const winner = browserRepository(storage, 700);
    first.load();
    winner.load();
    const winnerPlan = { ...aggregatePlan, updatedAt: 8 };
    await expect(winner.saveApplied(winnerPlan)).resolves.toEqual({ status: 'saved' });

    await expect(first.saveApplied({ ...aggregatePlan, updatedAt: 9 }))
      .resolves.toEqual({ status: 'unavailable' });
    expect(browserRepository(storage).load().applied).toEqual({ status: 'found', plan: winnerPlan });
  });

  it.each(['conflict', 'unavailable'] as const)(
    'maps a workspace %s write to unavailable',
    async (status) => {
      const saved = workspace();
      const workspaceRepository: WorkspaceRepository = {
        load: vi.fn(() => ({ status: 'found' as const, workspace: structuredClone(saved), needsMigration: false })),
        update: vi.fn(async () => status === 'conflict'
          ? { status: 'conflict' as const, currentRevision: 5 }
          : { status: 'unavailable' as const }),
        migrate: vi.fn(),
        replace: vi.fn(),
        resetInvalid: vi.fn(),
        subscribe: vi.fn(() => () => undefined),
      };
      const repository = new BrowserPortfolioRepository(workspaceRepository);
      repository.load();
      const scope: PortfolioScope = { type: 'aggregate' };

      await expect(repository.saveApplied(aggregatePlan)).resolves.toEqual({ status: 'unavailable' });
      await expect(repository.saveDraft(createCashOnlyDraft(200_000, 5)))
        .resolves.toEqual({ status: 'unavailable' });
      await expect(repository.clearDraft()).resolves.toEqual({ status: 'unavailable' });
      await expect(repository.clearScope(scope)).resolves.toEqual({ status: 'unavailable' });
    },
  );

  it.each(['invalid', 'unavailable'] as const)(
    'fails closed after an initially %s workspace without mutation',
    async (status) => {
      const update = vi.fn();
      const workspaceRepository: WorkspaceRepository = {
        load: vi.fn(() => status === 'invalid'
          ? { status: 'invalid' as const, raw: '{broken' }
          : { status: 'unavailable' as const }),
        update,
        migrate: vi.fn(),
        replace: vi.fn(),
        resetInvalid: vi.fn(),
        subscribe: vi.fn(() => () => undefined),
      };
      const repository = new BrowserPortfolioRepository(workspaceRepository);
      expect(repository.load()).toEqual({ applied: { status }, draft: { status } });
      await expect(repository.saveApplied(aggregatePlan)).resolves.toEqual({ status: 'unavailable' });
      await expect(repository.saveDraft(createCashOnlyDraft(200_000, 5)))
        .resolves.toEqual({ status: 'unavailable' });
      await expect(repository.clearDraft()).resolves.toEqual({ status: 'unavailable' });
      await expect(repository.clearScope({ type: 'aggregate' }))
        .resolves.toEqual({ status: 'unavailable' });
      expect(update).not.toHaveBeenCalled();
    },
  );
});
