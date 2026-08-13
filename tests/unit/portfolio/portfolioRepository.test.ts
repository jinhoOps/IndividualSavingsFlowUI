import { describe, expect, it, vi } from 'vitest';
import { createCashOnlyDraft } from '../../../src/portfolio/domain/allocation';
import type { PortfolioDraft, PortfolioPlan, PortfolioScope } from '../../../src/portfolio/domain/model';
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
  items: [{ id: 'a', name: '인덱스', shareUnits: 600_000, order: 0 }],
  cashShareUnits: 400_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 1,
  updatedAt: 1,
};
const locationPlan: PortfolioPlan = {
  ...aggregatePlan,
  scope: { type: 'location', locationId: 'loc-isa' },
  items: [{ id: 'loc-a', name: 'ISA 인덱스', shareUnits: 500_000, order: 0 }],
  cashShareUnits: 500_000,
  appliedAt: 2,
  updatedAt: 2,
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
  removeItem(key: string): void {
    this.writes.push(key);
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.writes.push(key);
    this.values.set(key, value);
  }
  resetLog(): void {
    this.reads.length = 0;
    this.writes.length = 0;
  }
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
    schemaVersion: 2,
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
      plans: [aggregatePlan, locationPlan],
      draft: { ...createCashOnlyDraft(200_000, 3), updatedAt: 3 },
      ...overrides,
    },
    locations: [{
      id: 'loc-isa',
      shortName: 'ISA',
      kind: 'brokerage',
      roles: ['investing'],
      createdAt: 1,
      updatedAt: 1,
    }],
    accountMap: { applied: null, draft: null, legacyPhaseA: { instruments: [], flows: [] } },
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
  it('starts empty when the workspace is absent and never consumes populated current-v1 keys', () => {
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

  it('loads only the aggregate plan and aggregate draft for the current UI', () => {
    const saved = workspace();
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));

    expect(browserRepository(storage).load()).toEqual({
      applied: { status: 'found', plan: aggregatePlan },
      draft: { status: 'found', draft: saved.portfolio.draft },
    });

    const locationDraft: PortfolioDraft = {
      ...createCashOnlyDraft(200_000, 4),
      scope: { type: 'location', locationId: 'loc-isa' },
    };
    saved.portfolio.draft = locationDraft;
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(saved));
    expect(browserRepository(storage).load()).toEqual({
      applied: { status: 'found', plan: aggregatePlan },
      draft: { status: 'empty' },
    });
  });

  it('upserts one aggregate plan revision and preserves every other slice and location scope', async () => {
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
    const nextPlan = { ...aggregatePlan, cashShareUnits: 500_000, items: [{ ...aggregatePlan.items[0], shareUnits: 500_000 }], updatedAt: 5 };
    storage.resetLog();

    await expect(repository.saveApplied(nextPlan)).resolves.toEqual({ status: 'saved' });

    const next = readWorkspace(storage);
    expect(next.revision).toBe(5);
    expect(next.updatedAt).toBe(600);
    expect(next.portfolio.plans).toEqual([nextPlan, locationPlan]);
    expect(next.portfolio.draft).toEqual(saved.portfolio.draft);
    for (const slice of ['main', 'simulation', 'locations', 'accountMap'] as const) {
      expect(next[slice]).toEqual(saved[slice]);
    }
    expect(next.portfolio.plans.filter(({ scope }) => scope.type === 'aggregate')).toHaveLength(1);
    expect(storage.reads.filter((key) => key === oldAppliedKey || key === oldDraftKey)).toEqual([]);
    expect(storage.writes.filter((key) => key === oldAppliedKey || key === oldDraftKey)).toEqual([]);
    expect(storage.getItem(oldAppliedKey)).toBe(oldApplied);
    expect(storage.getItem(oldDraftKey)).toBe(oldDraft);
  });

  it('saves an aggregate draft without changing applied plans or other slices', async () => {
    const saved = workspace({ draft: null });
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();
    const nextDraft = {
      ...createCashOnlyDraft(200_000, 5),
      items: [{ id: 'new', name: '성장', shareUnits: 250_000, order: 0 }],
      cashShareUnits: 750_000,
    };

    await expect(repository.saveDraft(nextDraft)).resolves.toEqual({ status: 'saved' });

    const next = readWorkspace(storage);
    expect(next.revision).toBe(5);
    expect(next.portfolio).toEqual({ plans: saved.portfolio.plans, draft: nextDraft });
    expect(next.main).toEqual(saved.main);
    expect(next.simulation).toEqual(saved.simulation);
  });

  it('creates a location-scoped applied plan only for an active investing location', async () => {
    const saved = workspace({ plans: [aggregatePlan] });
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();

    await expect(repository.saveApplied(locationPlan)).resolves.toEqual({ status: 'saved' });

    expect(readWorkspace(storage).portfolio.plans).toEqual([aggregatePlan, locationPlan]);
  });

  it('creates a location-scoped draft only for an active investing location', async () => {
    const locationDraft: PortfolioDraft = {
      ...createCashOnlyDraft(200_000, 3),
      scope: { type: 'location', locationId: 'loc-isa' },
    };
    const saved = workspace({ draft: null });
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();

    await expect(repository.saveDraft(locationDraft)).resolves.toEqual({ status: 'saved' });

    expect(readWorkspace(storage).portfolio.draft).toEqual(locationDraft);
  });

  it.each([
    ['archived', [{ ...workspace().locations[0], archivedAt: 2 }]],
    ['non-investing', [{ ...workspace().locations[0], roles: ['saving'] as ('saving')[] }]],
    ['missing', []],
  ])('rejects a new location-scoped applied plan for a %s registry target', async (
    _state,
    locations,
  ) => {
    const saved = workspace({ plans: [aggregatePlan] });
    saved.locations = locations;
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();

    await expect(repository.saveApplied(locationPlan)).resolves.toEqual({ status: 'unavailable' });

    expect(readWorkspace(storage)).toEqual(saved);
  });

  it('rejects a location-scoped applied creation when the locked current registry target is archived', async () => {
    const initiallyActive = workspace({ plans: [aggregatePlan] });
    let lockedCurrent = structuredClone(initiallyActive);
    lockedCurrent.locations[0] = { ...lockedCurrent.locations[0], archivedAt: 2 };
    const workspaceRepository: WorkspaceRepository = {
      load: vi.fn(() => ({ status: 'found' as const, workspace: structuredClone(initiallyActive), needsMigration: false })),
      update: vi.fn(async (_revision, mutate) => {
        try {
          lockedCurrent = mutate(structuredClone(lockedCurrent));
          return { status: 'saved' as const, workspace: structuredClone(lockedCurrent) };
        } catch {
          return { status: 'unavailable' as const };
        }
      }),
      migrate: vi.fn(),
      replace: vi.fn(),
      resetInvalid: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
    };
    const repository = new BrowserPortfolioRepository(workspaceRepository);
    repository.load();

    await expect(repository.saveApplied(locationPlan)).resolves.toEqual({ status: 'unavailable' });

    expect(lockedCurrent.portfolio.plans).toEqual([aggregatePlan]);
  });

  it.each([
    ['archived', [{ ...workspace().locations[0], archivedAt: 2 }]],
    ['non-investing', [{ ...workspace().locations[0], roles: ['saving'] as ('saving')[] }]],
    ['missing', []],
  ])('rejects a new location-scoped draft for a %s registry target', async (_state, locations) => {
    const locationDraft: PortfolioDraft = {
      ...createCashOnlyDraft(200_000, 3),
      scope: { type: 'location', locationId: 'loc-isa' },
    };
    const saved = workspace({ draft: null });
    saved.locations = locations;
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();

    await expect(repository.saveDraft(locationDraft)).resolves.toEqual({ status: 'unavailable' });

    expect(readWorkspace(storage)).toEqual(saved);
  });

  it('rejects a location-scoped draft creation when the locked current registry target loses investing', async () => {
    const locationDraft: PortfolioDraft = {
      ...createCashOnlyDraft(200_000, 3),
      scope: { type: 'location', locationId: 'loc-isa' },
    };
    const initiallyActive = workspace({ draft: null });
    let lockedCurrent = structuredClone(initiallyActive);
    lockedCurrent.locations[0] = { ...lockedCurrent.locations[0], roles: ['saving'] as ('saving')[] };
    const workspaceRepository: WorkspaceRepository = {
      load: vi.fn(() => ({ status: 'found' as const, workspace: structuredClone(initiallyActive), needsMigration: false })),
      update: vi.fn(async (_revision, mutate) => {
        try {
          lockedCurrent = mutate(structuredClone(lockedCurrent));
          return { status: 'saved' as const, workspace: structuredClone(lockedCurrent) };
        } catch {
          return { status: 'unavailable' as const };
        }
      }),
      migrate: vi.fn(),
      replace: vi.fn(),
      resetInvalid: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
    };
    const repository = new BrowserPortfolioRepository(workspaceRepository);
    repository.load();

    await expect(repository.saveDraft(locationDraft)).resolves.toEqual({ status: 'unavailable' });

    expect(lockedCurrent.portfolio.draft).toBeNull();
  });

  it.each([
    ['archived', [{ ...workspace().locations[0], archivedAt: 2 }]],
    ['non-investing', [{ ...workspace().locations[0], roles: ['saving'] as ('saving')[] }]],
  ])('updates an existing %s location-scoped applied plan while preserving its draft', async (
    _state,
    locations,
  ) => {
    const historicalDraft: PortfolioDraft = {
      ...createCashOnlyDraft(200_000, 3),
      scope: { type: 'location', locationId: 'loc-isa' },
    };
    const saved = workspace({ plans: [aggregatePlan, locationPlan], draft: historicalDraft });
    saved.locations = locations;
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();
    const nextPlan = { ...locationPlan, updatedAt: 4 };

    await expect(repository.saveApplied(nextPlan)).resolves.toEqual({ status: 'saved' });

    expect(readWorkspace(storage).portfolio).toEqual({
      plans: [aggregatePlan, nextPlan],
      draft: historicalDraft,
    });
  });

  it.each([
    ['archived', [{ ...workspace().locations[0], archivedAt: 2 }]],
    ['non-investing', [{ ...workspace().locations[0], roles: ['saving'] as ('saving')[] }]],
  ])('updates an existing %s location-scoped draft while preserving its plan', async (
    _state,
    locations,
  ) => {
    const historicalDraft: PortfolioDraft = {
      ...createCashOnlyDraft(200_000, 3),
      scope: { type: 'location', locationId: 'loc-isa' },
    };
    const saved = workspace({ plans: [aggregatePlan, locationPlan], draft: historicalDraft });
    saved.locations = locations;
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();
    const nextDraft = { ...historicalDraft, updatedAt: 4 };

    await expect(repository.saveDraft(nextDraft)).resolves.toEqual({ status: 'saved' });

    expect(readWorkspace(storage).portfolio).toEqual({
      plans: [aggregatePlan, locationPlan],
      draft: nextDraft,
    });
  });

  it.each([
    ['archived', [{ ...workspace().locations[0], archivedAt: 2 }]],
    ['non-investing', [{ ...workspace().locations[0], roles: ['saving'] as ('saving')[] }]],
  ])('clears an existing %s location scope', async (_state, locations) => {
    const historicalDraft: PortfolioDraft = {
      ...createCashOnlyDraft(200_000, 3),
      scope: { type: 'location', locationId: 'loc-isa' },
    };
    const saved = workspace({ plans: [aggregatePlan, locationPlan], draft: historicalDraft });
    saved.locations = locations;
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();

    await expect(repository.clearScope({ type: 'location', locationId: 'loc-isa' }))
      .resolves.toEqual({ status: 'saved' });

    expect(readWorkspace(storage).portfolio).toEqual({ plans: [aggregatePlan], draft: null });
  });

  it('clearScope removes only the matching plan and matching draft', async () => {
    const locationDraft: PortfolioDraft = {
      ...createCashOnlyDraft(200_000, 4),
      scope: { type: 'location', locationId: 'loc-isa' },
    };
    const saved = workspace({ draft: locationDraft });
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 600);
    repository.load();

    await expect(repository.clearScope({ type: 'aggregate' })).resolves.toEqual({ status: 'saved' });
    let next = readWorkspace(storage);
    expect(next.portfolio).toEqual({ plans: [locationPlan], draft: locationDraft });

    const afterAggregateClear = browserRepository(storage, 700);
    afterAggregateClear.load();
    await expect(afterAggregateClear.clearScope({ type: 'location', locationId: 'loc-isa' }))
      .resolves.toEqual({ status: 'saved' });
    next = readWorkspace(storage);
    expect(next.portfolio).toEqual({ plans: [], draft: null });
  });

  it('preserves a newer unrelated location scope while saving the loaded aggregate base', async () => {
    const saved = workspace();
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 700);
    repository.load();
    const newerLocation = { ...locationPlan, cashShareUnits: 600_000, items: [{ ...locationPlan.items[0], shareUnits: 400_000 }], updatedAt: 6 };
    const current = workspace({ plans: [aggregatePlan, newerLocation] });
    current.revision = 5;
    current.updatedAt = 650;
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));

    const nextPlan = { ...aggregatePlan, updatedAt: 7 };
    await expect(repository.saveApplied(nextPlan)).resolves.toEqual({ status: 'saved' });

    expect(readWorkspace(storage).portfolio.plans).toEqual([nextPlan, newerLocation]);
  });

  it('preserves a concurrently changed location draft when clearing the aggregate draft', async () => {
    const saved = workspace();
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(saved)]]));
    const repository = browserRepository(storage, 700);
    repository.load();
    const changedLocationDraft: PortfolioDraft = {
      ...createCashOnlyDraft(200_000, 6),
      scope: { type: 'location', locationId: 'loc-isa' },
      items: [{ id: 'loc-new', name: '새 ISA 배분', shareUnits: 400_000, order: 0 }],
      cashShareUnits: 600_000,
      updatedAt: 6,
    };
    const current = workspace({ draft: changedLocationDraft });
    current.revision = 5;
    current.updatedAt = 650;
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));
    const nextPlan = { ...aggregatePlan, updatedAt: 7 };

    await expect(repository.saveApplied(nextPlan)).resolves.toEqual({ status: 'saved' });
    await expect(repository.clearDraft()).resolves.toEqual({ status: 'saved' });

    expect(readWorkspace(storage).portfolio).toEqual({
      plans: [nextPlan, locationPlan],
      draft: changedLocationDraft,
    });
  });

  it('rejects a stale matching scope without overwriting its winner', async () => {
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
    'maps a workspace %s write to the current unavailable result',
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
    'fails closed after an initially %s workspace without attempting any mutation',
    async (status) => {
      let raw = '{"schemaVersion":1,"broken":true}';
      const initialRaw = raw;
      let durable = structuredClone(workspace());
      const initialDurable = structuredClone(durable);
      const update = vi.fn(async (
        _revision: number,
        mutate: (current: WorkspaceDocument) => WorkspaceDocument,
      ) => {
        durable = mutate(durable);
        raw = JSON.stringify(durable);
        return { status: 'saved' as const, workspace: structuredClone(durable) };
      });
      const workspaceRepository: WorkspaceRepository = {
        load: vi.fn(() => status === 'invalid'
          ? { status: 'invalid' as const, raw }
          : { status: 'unavailable' as const }),
        update,
        migrate: vi.fn(),
        replace: vi.fn(),
        resetInvalid: vi.fn(),
        subscribe: vi.fn(() => () => undefined),
      };
      const repository = new BrowserPortfolioRepository(workspaceRepository);

      expect(repository.load()).toEqual(status === 'invalid'
        ? { applied: { status: 'invalid' }, draft: { status: 'invalid' } }
        : { applied: { status: 'unavailable' }, draft: { status: 'unavailable' } });
      await expect(repository.saveApplied(aggregatePlan))
        .resolves.toEqual({ status: 'unavailable' });
      await expect(repository.saveDraft(createCashOnlyDraft(200_000, 5)))
        .resolves.toEqual({ status: 'unavailable' });
      await expect(repository.clearDraft()).resolves.toEqual({ status: 'unavailable' });
      await expect(repository.clearScope({ type: 'aggregate' }))
        .resolves.toEqual({ status: 'unavailable' });

      expect(update).not.toHaveBeenCalled();
      expect(durable).toEqual(initialDurable);
      expect(raw).toBe(initialRaw);
    },
  );
});
