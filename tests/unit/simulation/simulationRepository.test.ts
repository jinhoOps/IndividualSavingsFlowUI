import { describe, expect, it, vi } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { BrowserSimulationRepository } from '../../../src/simulation/infrastructure/simulationRepository';
import {
  WORKSPACE_STORAGE_KEY,
  type WorkspaceDocument,
} from '../../../src/workspace/domain/model';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../../src/workspace/infrastructure/workspaceRepository';

const oldSimulationKey = 'isf-simulation-compound-v1';
const source = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};
const draft = createDefaultSimulationDraft(source, 456);

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

function workspaceWithSimulation(savedDraft = draft): WorkspaceDocument {
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
    simulation: { draft: savedDraft },
    portfolio: {
      plans: [{
        schemaVersion: 2,
        scope: { type: 'aggregate' },
        items: [],
        cashShareUnits: 1_000_000,
        cashMode: 'automatic',
        syncedInvestmentWon: 200_000,
        appliedAt: 300,
        updatedAt: 300,
      }],
      draft: null,
    },
    locations: [],
    accountMap: { applied: null, draft: null },
  };
}

function browserRepository(storage: Storage, now = 500) {
  return new BrowserSimulationRepository(new BrowserWorkspaceRepository(storage, {
    now: () => now,
    saveLock: serialLock(),
  }));
}

describe('BrowserSimulationRepository workspace adapter', () => {
  it('starts empty when the workspace is absent and never consumes the populated old key', () => {
    const oldRaw = JSON.stringify({ ...draft, years: 29 });
    const storage = new TrackingStorage(new Map([[oldSimulationKey, oldRaw]]));
    const repository = browserRepository(storage);

    expect(repository.load()).toEqual({ status: 'empty' });

    expect(storage.reads).toEqual([WORKSPACE_STORAGE_KEY]);
    expect(storage.writes).toEqual([]);
    expect(storage.getItem(oldSimulationKey)).toBe(oldRaw);
  });

  it('loads only the valid workspace Simulation slice', () => {
    const workspace = workspaceWithSimulation();
    const storage = new TrackingStorage(new Map([
      [WORKSPACE_STORAGE_KEY, JSON.stringify(workspace)],
      [oldSimulationKey, JSON.stringify({ ...draft, years: 29 })],
    ]));
    storage.resetLog();

    expect(browserRepository(storage).load()).toEqual({
      status: 'found',
      draft,
      migration: null,
    });
    expect(storage.reads).toEqual([WORKSPACE_STORAGE_KEY]);
  });

  it('rejects a legacy Simulation draft inside the strict current workspace key', () => {
    const { targetAmountWon: _targetAmountWon, ...legacyDraft } = draft as typeof draft & {
      targetAmountWon: number;
    };
    const workspace = workspaceWithSimulation(
      { ...legacyDraft, schemaVersion: 2 } as unknown as typeof draft,
    );
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(workspace)]]));

    expect(browserRepository(storage).load()).toEqual({ status: 'invalid' });
    expect(storage.writes).toEqual([]);
  });

  it('rejects a retired workspace document inside the strict current workspace key', () => {
    const { targetAmountWon: _targetAmountWon, ...legacyDraft } = draft;
    const currentWorkspace = workspaceWithSimulation();
    const legacyWorkspace = {
      ...currentWorkspace,
      schemaVersion: 1,
      simulation: {
        draft: { ...legacyDraft, schemaVersion: 1, years: 31 },
      },
      accountMap: { applied: null, draft: null, instruments: [], flows: [] },
    };
    const storage = new TrackingStorage(new Map([[
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(legacyWorkspace),
    ]]));

    expect(browserRepository(storage).load()).toEqual({ status: 'invalid' });
    expect(storage.writes).toEqual([]);
  });

  it('saves one new workspace revision while preserving every non-Simulation slice', async () => {
    const workspace = workspaceWithSimulation();
    const oldRaw = JSON.stringify({ ...draft, years: 29 });
    const storage = new TrackingStorage(new Map([
      [WORKSPACE_STORAGE_KEY, JSON.stringify(workspace)],
      [oldSimulationKey, oldRaw],
    ]));
    const repository = browserRepository(storage, 600);
    repository.load();
    const nextDraft = { ...draft, years: 25, updatedAt: 550 };
    storage.resetLog();

    await expect(repository.save(nextDraft)).resolves.toEqual({ status: 'saved' });

    const saved = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
    expect(saved.revision).toBe(5);
    expect(saved.updatedAt).toBe(600);
    expect(saved.simulation).toEqual({ draft: nextDraft });
    for (const slice of ['main', 'portfolio', 'locations', 'accountMap'] as const) {
      expect(saved[slice]).toEqual(workspace[slice]);
    }
    expect(storage.reads.filter((key) => key === oldSimulationKey)).toEqual([]);
    expect(storage.writes.filter((key) => key === oldSimulationKey)).toEqual([]);
    expect(storage.getItem(oldSimulationKey)).toBe(oldRaw);
  });

  it('clears only the Simulation slice and preserves a newer unrelated slice', async () => {
    const workspace = workspaceWithSimulation();
    const storage = new TrackingStorage(new Map([[WORKSPACE_STORAGE_KEY, JSON.stringify(workspace)]]));
    const repository = browserRepository(storage, 700);
    repository.load();
    const current = workspaceWithSimulation();
    current.revision = 5;
    current.updatedAt = 650;
    current.main.applied = { ...current.main.applied!, monthlySavingWon: 900_000, updatedAt: 650 };
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));

    await expect(repository.clear()).resolves.toEqual({ status: 'cleared' });

    const saved = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
    expect(saved.revision).toBe(6);
    expect(saved.simulation).toEqual({ draft: null });
    expect(saved.main).toEqual(current.main);
    expect(saved.portfolio).toEqual(current.portfolio);
  });

  it('rejects a changed Simulation base without overwriting its winner', async () => {
    const storage = new TrackingStorage(new Map([[
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(workspaceWithSimulation()),
    ]]));
    const first = browserRepository(storage, 700);
    const winner = browserRepository(storage, 800);
    first.load();
    winner.load();
    const winningDraft = { ...draft, years: 26, updatedAt: 700 };
    await expect(winner.save(winningDraft)).resolves.toEqual({ status: 'saved' });

    await expect(first.save({ ...draft, years: 27, updatedAt: 800 }))
      .resolves.toEqual({ status: 'unavailable' });
    expect(browserRepository(storage).load()).toEqual({
      status: 'found',
      draft: winningDraft,
      migration: null,
    });
  });

  it.each(['conflict', 'unavailable'] as const)(
    'maps a workspace %s write to the current unavailable result',
    async (status) => {
      const workspace = workspaceWithSimulation();
      const workspaceRepository: WorkspaceRepository = {
        load: vi.fn(() => ({ status: 'found' as const, workspace: structuredClone(workspace), needsMigration: false })),
        update: vi.fn(async () => status === 'conflict'
          ? { status: 'conflict' as const, currentRevision: 5 }
          : { status: 'unavailable' as const }),
        migrate: vi.fn(),
        replace: vi.fn(),
        resetInvalid: vi.fn(),
        subscribe: vi.fn(() => () => undefined),
      };
      const repository = new BrowserSimulationRepository(workspaceRepository);
      repository.load();

      await expect(repository.save({ ...draft, years: 24 })).resolves.toEqual({ status: 'unavailable' });
      await expect(repository.clear()).resolves.toEqual({ status: 'unavailable' });
    },
  );

  it.each(['invalid', 'unavailable'] as const)(
    'fails closed after an initially %s workspace without attempting any mutation',
    async (status) => {
      let raw = '{"schemaVersion":1,"broken":true}';
      const initialRaw = raw;
      let durable = structuredClone(workspaceWithSimulation());
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
      const repository = new BrowserSimulationRepository(workspaceRepository);

      expect(repository.load()).toEqual(status === 'invalid'
        ? { status: 'invalid' }
        : { status: 'unavailable' });
      await expect(repository.save({ ...draft, years: 24 }))
        .resolves.toEqual({ status: 'unavailable' });
      await expect(repository.clear()).resolves.toEqual({ status: 'unavailable' });

      expect(update).not.toHaveBeenCalled();
      expect(durable).toEqual(initialDurable);
      expect(raw).toBe(initialRaw);
    },
  );
});
