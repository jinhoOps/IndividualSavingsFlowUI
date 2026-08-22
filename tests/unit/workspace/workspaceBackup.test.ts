import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountMapApplied, AccountMapDraft } from '../../../src/account-map/domain/model';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import type { WorkspaceDocument } from '../../../src/workspace/domain/model';
import { WORKSPACE_STORAGE_KEY } from '../../../src/workspace/domain/model';
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
} from '../../../src/workspace/infrastructure/workspaceBackup';
import { BrowserWorkspaceRepository } from '../../../src/workspace/infrastructure/workspaceRepository';
import type {
  WorkspaceSaveGuard,
  WorkspaceSaveLock,
} from '../../../src/workspace/infrastructure/workspaceSaveLock';
import { MemoryStorage } from '../simulation/MemoryStorage';

const aggregatePlan: PortfolioPlan = {
  schemaVersion: 2,
  scope: { type: 'aggregate' },
  items: [{
    id: 'asset-us', name: '미국 인덱스', shareUnits: 700_000, order: 0,
    classification: 'growth', classificationOrigin: 'automatic',
  }],
  cashShareUnits: 300_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 600_000,
  appliedAt: 30,
  updatedAt: 30,
};

const locationPlan: PortfolioPlan = {
  ...aggregatePlan,
  scope: { type: 'location', locationId: 'loc-isa' },
  items: [{
    id: 'asset-bond', name: '국채', shareUnits: 400_000, order: 0,
    classification: 'stable', classificationOrigin: 'automatic',
  }],
  cashShareUnits: 600_000,
  appliedAt: 31,
  updatedAt: 31,
};

function completeWorkspace(overrides: Partial<WorkspaceDocument> = {}): WorkspaceDocument {
  return {
    schemaVersion: 2,
    revision: 41,
    updatedAt: 500,
    main: {
      applied: {
        schemaVersion: 2,
        monthlyNetIncomeWon: 5_000_000,
        monthlyHousingWon: 1_000_000,
        monthlyLivingWon: 900_000,
        monthlySavingWon: 700_000,
        monthlyInvestmentWon: 600_000,
        updatedAt: 100,
      },
      setupProgress: null,
    },
    simulation: {
      draft: {
        schemaVersion: 3,
        source: {
          monthlySavingsWon: 700_000,
          monthlyInvestmentWon: 600_000,
          mainUpdatedAt: 100,
        },
        initialInvestmentWon: 10_000_000,
        targetAmountWon: 100_000_000,
        years: 20,
        expectedAnnualReturnPercent: 8,
        baseRatePercent: 2.5,
        inflationOffsetPercentPoints: -0.5,
        amountMode: 'real',
        updatedAt: 200,
      },
    },
    portfolio: {
      plans: [aggregatePlan, locationPlan],
      draft: null,
    },
    locations: [{
      id: 'loc-isa',
      shortName: 'ISA',
      institution: { id: 'bank-1', name: '미래은행' },
      kind: 'brokerage',
      roles: ['saving', 'investing'],
      createdAt: 10,
      updatedAt: 20,
    }],
    accountMap: { applied: null, draft: null, legacyPhaseA: { instruments: [], flows: [] } },
    ...overrides,
  };
}

function envelope(workspace: unknown = completeWorkspace()): string {
  return JSON.stringify({
    format: 'isf-workspace-backup',
    formatVersion: 1,
    exportedAt: 900,
    workspace,
  });
}

function nestedLegacySimulationDraft(
  schemaVersion: 1 | 2,
  initialInvestmentWon: number,
): Record<string, unknown> {
  const draft = completeWorkspace().simulation.draft;
  if (draft === null) throw new Error('expected Simulation fixture');
  const { targetAmountWon: _targetAmountWon, ...legacy } = draft;
  return { ...legacy, schemaVersion, initialInvestmentWon };
}

function accountMapApplied(overrides: Partial<AccountMapApplied> = {}): AccountMapApplied {
  return {
    schemaVersion: 1,
    sourceMainUpdatedAt: 100,
    customPurposes: [],
    links: [],
    layout: 'purpose',
    setupCompletedAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function accountMapDraft(overrides: Partial<AccountMapDraft> = {}): AccountMapDraft {
  return {
    schemaVersion: 1,
    sourceMainUpdatedAt: 100,
    customPurposes: [],
    links: [],
    step: 'connect',
    updatedAt: 100,
    ...overrides,
  };
}

function overCapacityPurposes(): AccountMapApplied['customPurposes'] {
  return [{
    id: 'custom:telecom',
    parentId: 'system:living',
    name: '통신비',
    targetMonthlyWon: 900_001,
    createdAt: 10,
    updatedAt: 10,
  }];
}

function phaseBReleaseWorkspace(): WorkspaceDocument {
  const workspace = completeWorkspace();
  workspace.portfolio.draft = {
    schemaVersion: 2,
    scope: { type: 'aggregate' },
    items: [{
      id: 'asset-us', name: '미국 인덱스', shareUnits: 600_000, order: 0,
      classification: 'growth', classificationOrigin: 'automatic',
    }],
    cashShareUnits: 400_000,
    cashMode: 'automatic',
    syncedInvestmentWon: 600_000,
    updatedAt: 40,
    inputMode: 'amount',
    isApplicable: true,
  };
  workspace.accountMap.applied = accountMapApplied({
    layout: 'account',
    customPurposes: [{
      id: 'custom:trip',
      parentId: 'system:living',
      name: '여행',
      targetMonthlyWon: 200_000,
      archivedAt: 35,
      createdAt: 10,
      updatedAt: 35,
    }],
    links: [
      {
        id: 'saving-isa',
        purposeId: 'system:saving',
        locationId: 'loc-isa',
        monthlyAmountWon: 700_000,
        remainder: true,
        status: 'active',
        createdAt: 10,
        updatedAt: 30,
      },
      {
        id: 'investing-isa',
        purposeId: 'system:investing',
        locationId: 'loc-isa',
        monthlyAmountWon: 600_000,
        remainder: true,
        status: 'active',
        createdAt: 10,
        updatedAt: 30,
      },
      {
        id: 'trip-suspended',
        purposeId: 'custom:trip',
        locationId: 'loc-isa',
        monthlyAmountWon: 200_000,
        remainder: false,
        status: 'suspended',
        suspendedReason: 'user',
        createdAt: 10,
        updatedAt: 35,
      },
      {
        id: 'living-suspended',
        purposeId: 'system:living',
        locationId: 'loc-isa',
        monthlyAmountWon: 100_000,
        remainder: false,
        status: 'suspended',
        suspendedReason: 'user',
        createdAt: 11,
        updatedAt: 35,
      },
    ],
    updatedAt: 35,
  });
  return workspace;
}

function errorCode(operation: () => unknown): string | undefined {
  try {
    operation();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('workspace backup', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips the complete Phase-B map and Portfolio compatibility state', () => {
    const workspace = phaseBReleaseWorkspace();
    const text = exportWorkspaceBackup(workspace, 900);
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(Object.keys(parsed).sort()).toEqual([
      'exportedAt',
      'format',
      'formatVersion',
      'workspace',
    ]);
    expect(parsed).toEqual({
      format: 'isf-workspace-backup',
      formatVersion: 1,
      exportedAt: 900,
      workspace,
    });
    const imported = importWorkspaceBackup(text);
    expect(imported).toEqual(workspace);
    expect(imported).not.toBe(workspace);
    expect(JSON.stringify(imported.accountMap)).toBe(JSON.stringify(workspace.accountMap));
    expect(JSON.stringify(imported.locations)).toBe(JSON.stringify(workspace.locations));
    expect(JSON.stringify(imported.portfolio)).toBe(JSON.stringify(workspace.portfolio));
  });

  it('imports a v1 envelope through the lossless workspace migration', () => {
    const current = completeWorkspace();
    const legacy = {
      ...current,
      schemaVersion: 1,
      accountMap: { applied: null, draft: null, instruments: [], flows: [] },
    };

    const imported = importWorkspaceBackup(envelope(legacy));

    expect(imported.schemaVersion).toBe(2);
    expect(imported.main).toEqual(legacy.main);
    expect(imported.simulation).toEqual(legacy.simulation);
    expect(JSON.stringify(imported.portfolio)).toBe(JSON.stringify(legacy.portfolio));
    expect(imported.accountMap.legacyPhaseA).toEqual({ instruments: [], flows: [] });
  });

  it.each([1, 2] as const)(
    'imports a nested Simulation v%i draft with its automatic target and preserves other slices',
    (schemaVersion) => {
      const workspace = completeWorkspace({
        simulation: { draft: nestedLegacySimulationDraft(schemaVersion, 10_000_000) as never },
      });

      const imported = importWorkspaceBackup(envelope(workspace));

      expect(imported.simulation.draft).toEqual({
        ...nestedLegacySimulationDraft(schemaVersion, 10_000_000),
        schemaVersion: 3,
        targetAmountWon: 100_000_000,
      });
      expect(JSON.stringify(imported.main)).toBe(JSON.stringify(workspace.main));
      expect(JSON.stringify(imported.portfolio)).toBe(JSON.stringify(workspace.portfolio));
      expect(JSON.stringify(imported.locations)).toBe(JSON.stringify(workspace.locations));
      expect(JSON.stringify(imported.accountMap)).toBe(JSON.stringify(workspace.accountMap));
    },
  );

  it.each([1, 2] as const)(
    'imports a high-principal nested Simulation v%i draft as goal-required',
    (schemaVersion) => {
      const workspace = completeWorkspace({
        simulation: { draft: nestedLegacySimulationDraft(schemaVersion, 200_000_000) as never },
      });

      const imported = importWorkspaceBackup(envelope(workspace));

      expect(imported.simulation.draft).toEqual({
        ...nestedLegacySimulationDraft(schemaVersion, 200_000_000),
        schemaVersion: 3,
        targetAmountWon: null,
      });
    },
  );

  it('atomically rejects a malformed Simulation target without touching stored workspace data', () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(completeWorkspace({ revision: 17, updatedAt: 777 }));
    storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    const setItem = vi.spyOn(storage, 'setItem');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    const current = completeWorkspace();
    if (current.simulation.draft === null) throw new Error('expected Simulation fixture');
    const malformed = completeWorkspace({
      simulation: {
        draft: {
          ...current.simulation.draft,
          initialInvestmentWon: 200_000_000,
          targetAmountWon: 200_000_000,
        },
      },
    });

    expect(errorCode(() => importWorkspaceBackup(envelope(malformed)))).toBe('backup-schema');
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('exports no storage keys, lease metadata, or trophy state', () => {
    const text = exportWorkspaceBackup(completeWorkspace(), 900);

    for (const excluded of [
      'isf-main-v2',
      'isf-simulation-v2',
      'isf-portfolio-v2',
      'isf-account-map-v1',
      'isf-workspace-v1-save-lease',
      'owner',
      'ticket',
      'trophy',
      '트로피',
    ]) {
      expect(text).not.toContain(excluded);
    }
  });

  it('validates the supplied workspace before exporting it', () => {
    const invalidSchema = {
      ...completeWorkspace(),
      main: { applied: { ...completeWorkspace().main.applied, monthlyNetIncomeWon: -1 }, setupProgress: null },
    } as WorkspaceDocument;
    const missingReference = {
      ...completeWorkspace(),
      locations: [],
    };

    expect(errorCode(() => exportWorkspaceBackup(invalidSchema, 900))).toBe('backup-schema');
    expect(errorCode(() => exportWorkspaceBackup(missingReference, 900))).toBe('backup-reference');
  });

  it.each([
    ['malformed JSON', '{bad', 'backup-json'],
    ['wrong format', JSON.stringify({
      format: 'main-backup', formatVersion: 1, exportedAt: 900, workspace: completeWorkspace(),
    }), 'backup-format'],
    ['wrong version', JSON.stringify({
      format: 'isf-workspace-backup', formatVersion: 2, exportedAt: 900, workspace: completeWorkspace(),
    }), 'backup-format'],
    ['extra envelope key', JSON.stringify({
      format: 'isf-workspace-backup', formatVersion: 1, exportedAt: 900,
      workspace: completeWorkspace(), extra: true,
    }), 'backup-format'],
    ['old Main-only backup', JSON.stringify(completeWorkspace().main.applied), 'backup-format'],
    ['invalid exported timestamp', JSON.stringify({
      format: 'isf-workspace-backup', formatVersion: 1, exportedAt: -1, workspace: completeWorkspace(),
    }), 'backup-schema'],
    ['invalid Main slice', envelope({
      ...completeWorkspace(),
      main: { applied: { ...completeWorkspace().main.applied, monthlyNetIncomeWon: -1 }, setupProgress: null },
    }), 'backup-schema'],
    ['invalid Simulation slice', envelope({
      ...completeWorkspace(),
      simulation: { draft: { ...completeWorkspace().simulation.draft, years: 31 } },
    }), 'backup-schema'],
    ['invalid Portfolio slice', envelope({
      ...completeWorkspace(),
      portfolio: { plans: [{ ...aggregatePlan, cashShareUnits: 1 }], draft: null },
    }), 'backup-schema'],
    ['invalid Account Map slice', envelope({
      ...completeWorkspace(),
      accountMap: { applied: {}, draft: null, instruments: [], flows: [] },
    }), 'backup-schema'],
  ])('rejects %s with %s', (_label, text, expected) => {
    expect(errorCode(() => importWorkspaceBackup(text))).toBe(expected);
  });

  it.each([
    ['a missing location reference', () => ({
      ...completeWorkspace(),
      locations: [],
    })],
    ['a duplicate normalized location name', () => ({
      ...completeWorkspace(),
      locations: [
        ...completeWorkspace().locations,
        {
          ...completeWorkspace().locations[0],
          id: 'loc-duplicate',
          shortName: ' isa ',
        },
      ],
    })],
    ['an over-capacity purpose group', () => ({
      ...completeWorkspace(),
      locations: Array.from({ length: 11 }, (_, index) => ({
        id: `loc-${index}`,
        shortName: `L${index}`,
        kind: 'bank' as const,
        roles: ['income' as const],
        createdAt: 10,
        updatedAt: 20,
      })),
      portfolio: { plans: [aggregatePlan], draft: null },
    })],
  ])('rejects %s as backup-reference', (_label, makeWorkspace) => {
    expect(errorCode(() => importWorkspaceBackup(envelope(makeWorkspace())))).toBe('backup-reference');
  });

  it('gives schema failures precedence over simultaneous reference failures', () => {
    const mixedFailure = {
      ...completeWorkspace(),
      main: {
        applied: { ...completeWorkspace().main.applied, monthlyNetIncomeWon: -1 },
        setupProgress: null,
      },
      locations: [],
    } as WorkspaceDocument;

    expect(errorCode(() => importWorkspaceBackup(envelope(mixedFailure)))).toBe('backup-schema');
    expect(errorCode(() => exportWorkspaceBackup(mixedFailure, 900))).toBe('backup-schema');
  });

  it('parses without touching browser storage', () => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    const setItem = vi.spyOn(storage, 'setItem');

    expect(importWorkspaceBackup(envelope())).toEqual(completeWorkspace());
    expect(setItem).not.toHaveBeenCalled();
  });

  it.each([
    ['an applied future Main source', {
      applied: accountMapApplied({ sourceMainUpdatedAt: 101 }),
    }],
    ['an applied synchronized custom target excess', {
      applied: accountMapApplied({ customPurposes: overCapacityPurposes() }),
    }],
    ['a draft future Main source', {
      draft: accountMapDraft({ sourceMainUpdatedAt: 101 }),
    }],
    ['a draft synchronized custom target excess', {
      draft: accountMapDraft({ customPurposes: overCapacityPurposes() }),
    }],
  ])('rejects %s without changing exact raw workspace storage', (_label, accountMapState) => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(completeWorkspace({ revision: 17, updatedAt: 777 }));
    storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    const setItem = vi.spyOn(storage, 'setItem');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

    const invalid = completeWorkspace({
      accountMap: {
        ...completeWorkspace().accountMap,
        ...accountMapState,
      },
    });

    expect(errorCode(() => importWorkspaceBackup(envelope(invalid)))).toBe('backup-schema');
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('replaces a parsed backup once at the current revision plus one', async () => {
    const storage = new MemoryStorage();
    const current = completeWorkspace({ revision: 6, updatedAt: 700 });
    const imported = completeWorkspace({ revision: 99, updatedAt: 500 });
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));
    const setItem = vi.spyOn(storage, 'setItem');
    const repository = new BrowserWorkspaceRepository(storage, {
      now: () => 800,
      saveLock: serialLock(),
    });

    const parsed = importWorkspaceBackup(envelope(imported));
    const loaded = repository.load();
    if (loaded.status !== 'found') throw new Error('expected current workspace');
    const result = await repository.replace(loaded.workspace.revision, parsed);

    expect(result.status).toBe('saved');
    if (result.status !== 'saved') throw new Error('expected saved replacement');
    expect(result.workspace.revision).toBe(7);
    expect(result.workspace.main).toEqual(imported.main);
    expect(result.workspace.simulation).toEqual(imported.simulation);
    expect(result.workspace.portfolio).toEqual(imported.portfolio);
    expect(result.workspace.locations).toEqual(imported.locations);
    expect(result.workspace.accountMap).toEqual(imported.accountMap);
    expect(setItem.mock.calls.filter(([key]) => key === WORKSPACE_STORAGE_KEY)).toHaveLength(1);
  });

  it('retains the exact old raw on replace conflict', async () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(completeWorkspace({ revision: 6 }));
    storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    const repository = new BrowserWorkspaceRepository(storage, { saveLock: serialLock() });

    const result = await repository.replace(5, importWorkspaceBackup(envelope()));

    expect(result).toEqual({ status: 'conflict', currentRevision: 6 });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
  });

  it('retains the exact old raw when the committed write fails', async () => {
    const storage = new FailingWorkspaceStorage();
    const raw = JSON.stringify(completeWorkspace({ revision: 6 }));
    storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    storage.failWorkspaceWrites = true;
    const repository = new BrowserWorkspaceRepository(storage, { saveLock: serialLock() });

    const result = await repository.replace(6, importWorkspaceBackup(envelope()));

    expect(result).toEqual({ status: 'unavailable' });
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
  });
});

function serialLock(): WorkspaceSaveLock {
  return {
    async runExclusive<T>(task: (guard: WorkspaceSaveGuard) => Promise<T>): Promise<T> {
      return await task({ assertOwned: () => undefined });
    },
  };
}

class FailingWorkspaceStorage extends MemoryStorage {
  failWorkspaceWrites = false;

  override setItem(key: string, value: string): void {
    if (this.failWorkspaceWrites && key === WORKSPACE_STORAGE_KEY) {
      throw new Error('quota');
    }
    super.setItem(key, value);
  }
}
