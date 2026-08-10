import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import {
  BrowserMainRepository,
  isMainDataShape,
} from '../../../src/main/infrastructure/mainRepository';
import { createEmptyWorkspace, WORKSPACE_STORAGE_KEY, type WorkspaceDocument } from '../../../src/workspace/domain/model';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../../src/workspace/infrastructure/workspaceRepository';

class MemoryStorage implements Storage {
  readonly reads: string[] = [];
  readonly writes: string[] = [];

  constructor(private readonly values = new Map<string, string>()) {}

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    this.reads.push(key);
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.writes.push(key);
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.writes.push(key);
    this.values.set(key, value);
  }

  seed(key: string, value: string): void {
    this.values.set(key, value);
  }

  resetLog(): void {
    this.reads.length = 0;
    this.writes.length = 0;
  }
}

const oldRecords = new Map([
  ['isf-main-v2', JSON.stringify({ schemaVersion: 2, monthlyNetIncomeWon: 9_999_999 })],
  ['isf-main-v2-pending', '{pending-main'],
  ['isf-main-v2-setup-progress', '{old-progress'],
  ['isf-main-v2-dismissed-recovery', '999'],
  ['isf-main-v2-quarantined-current', '{quarantined-current'],
  ['isf-main-v2-quarantined-pending', '{quarantined-pending'],
  ['isf-main-v2-history', '[{"updatedAt":999}]'],
  ['isf-main-v1', '{old-v1'],
  ['isf-rebuild-v1', '{legacy-rebuild'],
  ['isf-step1-active', '{legacy-active'],
]);

function mainData(overrides: Partial<MainData> = {}): MainData {
  return {
    schemaVersion: 2,
    updatedAt: 100,
    monthlyNetIncomeWon: 4_200_000,
    monthlyHousingWon: 900_000,
    monthlyLivingWon: 1_000_000,
    monthlySavingWon: 600_000,
    monthlyInvestmentWon: 800_000,
    ...overrides,
  };
}

function populatedWorkspace(): WorkspaceDocument {
  return {
    schemaVersion: 1,
    revision: 4,
    updatedAt: 400,
    main: { applied: mainData(), setupProgress: null },
    simulation: {
      draft: {
        schemaVersion: 2,
        source: {
          monthlySavingsWon: 600_000,
          monthlyInvestmentWon: 800_000,
          mainUpdatedAt: 100,
        },
        initialInvestmentWon: 0,
        years: 20,
        expectedAnnualReturnPercent: 9,
        baseRatePercent: 2.75,
        inflationOffsetPercentPoints: -0.25,
        amountMode: 'nominal',
        updatedAt: 200,
      },
    },
    portfolio: {
      plans: [{
        schemaVersion: 2,
        scope: { type: 'aggregate' },
        items: [{ id: 'asset-1', name: '미국 인덱스', shareUnits: 800_000, order: 0 }],
        cashShareUnits: 200_000,
        cashMode: 'automatic',
        syncedInvestmentWon: 800_000,
        appliedAt: 300,
        updatedAt: 300,
      }],
      draft: null,
    },
    locations: [{
      id: 'loc-isa',
      shortName: 'ISA',
      kind: 'brokerage',
      roles: ['investing'],
      createdAt: 10,
      updatedAt: 20,
    }],
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  };
}

function serialLock() {
  return {
    async runExclusive<T>(task: (guard: { assertOwned(): void }) => T | Promise<T>): Promise<T> {
      return await task({ assertOwned: () => undefined });
    },
  };
}

function browserRepositories(storage: Storage, mainNow = 500, workspaceNow = 600) {
  const workspaceRepository = new BrowserWorkspaceRepository(storage, {
    now: () => workspaceNow,
    saveLock: serialLock(),
  });
  return {
    workspaceRepository,
    mainRepository: new BrowserMainRepository(workspaceRepository, () => mainNow),
  };
}

function seedWorkspace(storage: MemoryStorage, workspace: WorkspaceDocument): void {
  storage.seed(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
}

describe('BrowserMainRepository workspace adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts empty when the workspace is absent and never consumes populated old records', async () => {
    const storage = new MemoryStorage(new Map(oldRecords));
    const before = new Map([...oldRecords].map(([key]) => [key, storage.getItem(key)]));
    storage.resetLog();
    const { mainRepository } = browserRepositories(storage);

    await expect(mainRepository.load()).resolves.toEqual({ status: 'empty', data: null, original: null });

    expect(storage.reads).toEqual([WORKSPACE_STORAGE_KEY]);
    expect(storage.writes).toEqual([]);
    for (const [key, raw] of before) expect(storage.getItem(key)).toBe(raw);
  });

  it('loads only the applied Main value from the workspace slice', async () => {
    const storage = new MemoryStorage(new Map(oldRecords));
    const workspace = populatedWorkspace();
    seedWorkspace(storage, workspace);
    storage.resetLog();
    const { mainRepository } = browserRepositories(storage);

    await expect(mainRepository.load()).resolves.toEqual({
      status: 'current',
      data: workspace.main.applied,
      original: workspace.main.applied,
    });

    expect(storage.reads).toEqual([WORKSPACE_STORAGE_KEY]);
    expect(storage.writes).toEqual([]);
  });

  it('commits one workspace revision and preserves every non-Main slice by value', async () => {
    const storage = new MemoryStorage(new Map(oldRecords));
    const workspace = populatedWorkspace();
    seedWorkspace(storage, workspace);
    storage.resetLog();
    const { mainRepository } = browserRepositories(storage, 500, 600);
    const draft = mainData({ monthlyNetIncomeWon: 5_000_000, updatedAt: 100 });

    await expect(mainRepository.save(draft)).resolves.toEqual({ ...draft, updatedAt: 500 });

    const saved = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
    expect(saved.revision).toBe(5);
    expect(saved.updatedAt).toBe(600);
    expect(saved.main).toEqual({ applied: { ...draft, updatedAt: 500 }, setupProgress: null });
    for (const slice of ['simulation', 'portfolio', 'locations', 'accountMap'] as const) {
      expect(saved[slice]).toEqual(workspace[slice]);
    }
    expect(storage.writes.filter((key) => key === WORKSPACE_STORAGE_KEY)).toHaveLength(1);
    expect(storage.reads.filter((key) => oldRecords.has(key))).toEqual([]);
    expect(storage.writes.filter((key) => oldRecords.has(key))).toEqual([]);
    for (const [key, raw] of oldRecords) expect(storage.getItem(key)).toBe(raw);
  });

  it('round-trips setup progress only through the Main workspace slice', async () => {
    const storage = new MemoryStorage(new Map(oldRecords));
    const workspace = populatedWorkspace();
    seedWorkspace(storage, workspace);
    storage.resetLog();
    const { mainRepository } = browserRepositories(storage, 700, 800);
    const draft = mainData({ monthlyHousingWon: 1_100_000 });
    const otherSlices = {
      simulation: workspace.simulation,
      portfolio: workspace.portfolio,
      locations: workspace.locations,
      accountMap: workspace.accountMap,
    };

    await mainRepository.saveSetupProgress('housing', draft, 'restart');
    expect(mainRepository.loadSetupProgress()).toEqual({
      kind: 'restart',
      step: 'housing',
      draft,
      savedAt: 700,
    });
    let saved = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
    expect(saved.revision).toBe(5);
    expect({
      simulation: saved.simulation,
      portfolio: saved.portfolio,
      locations: saved.locations,
      accountMap: saved.accountMap,
    }).toEqual(otherSlices);

    await mainRepository.clearSetupProgress();
    expect(mainRepository.loadSetupProgress()).toBeNull();
    saved = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
    expect(saved.revision).toBe(6);
    expect(saved.main.applied).toEqual(workspace.main.applied);
    expect(storage.reads.filter((key) => oldRecords.has(key))).toEqual([]);
    expect(storage.writes.filter((key) => oldRecords.has(key))).toEqual([]);
    for (const [key, raw] of oldRecords) expect(storage.getItem(key)).toBe(raw);
  });

  it('maps a stale workspace revision to a storage failure without overwriting the winner', async () => {
    const initial = populatedWorkspace();
    const winner = populatedWorkspace();
    winner.revision = initial.revision + 1;
    winner.updatedAt = 900;
    winner.main.applied = mainData({ monthlyNetIncomeWon: 6_000_000, updatedAt: 900 });
    let durable = structuredClone(initial);
    const workspaceRepository: WorkspaceRepository = {
      load: () => ({ status: 'found', workspace: structuredClone(initial) }),
      update: vi.fn(async () => {
        durable = structuredClone(winner);
        return { status: 'conflict', currentRevision: winner.revision } as const;
      }),
      replace: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
    };
    const repository = new BrowserMainRepository(workspaceRepository, () => 1_000);

    await expect(repository.save(mainData({ monthlyNetIncomeWon: 5_000_000 })))
      .rejects.toThrow('workspace');

    expect(durable).toEqual(winner);
  });

  it('returns the invalid workspace raw for the existing recovery presentation', async () => {
    const raw = '{malformed-workspace';
    const storage = new MemoryStorage();
    storage.seed(WORKSPACE_STORAGE_KEY, raw);
    const { mainRepository } = browserRepositories(storage);

    await expect(mainRepository.load()).resolves.toMatchObject({
      status: 'failed',
      data: null,
      original: raw,
      raw,
      reason: expect.stringContaining('workspace'),
    });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
  });

  it('rejects invalid applied and setup drafts before a workspace write', async () => {
    const workspaceRepository: WorkspaceRepository = {
      load: vi.fn(() => ({ status: 'empty', workspace: createEmptyWorkspace(100) } as const)),
      update: vi.fn(),
      replace: vi.fn(),
      subscribe: vi.fn(() => () => undefined),
    };
    const repository = new BrowserMainRepository(workspaceRepository, () => 200);
    const invalid = mainData({ monthlyNetIncomeWon: -1 });

    await expect(repository.save(invalid)).rejects.toThrow('invalid');
    await expect(repository.saveSetupProgress('income', invalid)).rejects.toThrow('invalid');
    expect(workspaceRepository.update).not.toHaveBeenCalled();
  });

  it.each([
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('retains the canonical Main scalar boundary for updatedAt=%s', (updatedAt) => {
    expect(isMainDataShape({ ...mainData(), updatedAt })).toBe(false);
  });
});
