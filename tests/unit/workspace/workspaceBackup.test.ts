import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceDocument } from '../../../src/workspace/domain/model';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';
import {
  exportWorkspaceBackup,
  importWorkspaceBackup,
} from '../../../src/workspace/infrastructure/workspaceBackup';

function completeWorkspace(overrides: Partial<WorkspaceDocument> = {}): WorkspaceDocument {
  return {
    schemaVersion: 3,
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
      plans: [{
        schemaVersion: 2,
        scope: { type: 'aggregate' },
        items: [{
          id: 'asset-us',
          name: '미국 인덱스',
          shareUnits: 700_000,
          order: 0,
          classification: 'growth',
          classificationOrigin: 'automatic',
        }],
        cashShareUnits: 300_000,
        cashMode: 'automatic',
        syncedInvestmentWon: 600_000,
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
    accountMap: {
      applied: {
        schemaVersion: 2,
        sourceMainUpdatedAt: 100,
        customPurposes: [],
        links: [{
          id: 'investing-isa',
          purposeId: 'system:investing',
          locationId: 'loc-isa',
          monthlyAmountWon: 600_000,
          remainder: true,
          status: 'active',
          createdAt: 30,
          updatedAt: 30,
        }],
        setupCompletedAt: 400,
        updatedAt: 400,
      },
      draft: null,
    },
    ...overrides,
  };
}

function retiredWorkspaceV2() {
  const current = completeWorkspace();
  return {
    ...current,
    schemaVersion: 2,
    portfolio: {
      plans: [
        ...current.portfolio.plans,
        {
          ...current.portfolio.plans[0],
          scope: { type: 'location', locationId: 'loc-isa' },
          appliedAt: 301,
          updatedAt: 301,
        },
      ],
      draft: null,
    },
    accountMap: {
      applied: {
        ...current.accountMap.applied,
        schemaVersion: 1,
        layout: 'account',
      },
      draft: null,
      legacyPhaseA: { instruments: [], flows: [] },
    },
  };
}

function retiredWorkspaceV1() {
  const retired = retiredWorkspaceV2();
  return {
    ...retired,
    schemaVersion: 1,
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  };
}

function envelope(formatVersion: number, workspace: unknown, exportedAt = 900): string {
  return JSON.stringify({
    format: 'isf-workspace-backup',
    formatVersion,
    exportedAt,
    workspace,
  });
}

function deeplyNestedFormatV1Envelope(depth: number): string {
  let nestedMain = 'null';
  for (let index = 0; index < depth; index += 1) {
    nestedMain = `{"nested":${nestedMain}}`;
  }

  const { main: _main, ...retiredWithoutMain } = retiredWorkspaceV2();
  const serializedWorkspace = JSON.stringify(retiredWithoutMain);
  return `{"format":"isf-workspace-backup","formatVersion":1,"exportedAt":900,"workspace":{"main":${nestedMain},${serializedWorkspace.slice(1)}}`;
}

function errorCode(operation: () => unknown): string | undefined {
  try {
    operation();
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('workspace backup v2', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exports the current workspace in an exact format-v2 envelope', () => {
    const workspace = createEmptyWorkspace(100);
    expect(JSON.parse(exportWorkspaceBackup(workspace, 200))).toEqual({
      format: 'isf-workspace-backup',
      formatVersion: 2,
      exportedAt: 200,
      workspace,
    });
  });

  it('round-trips a complete current workspace without sharing caller objects', () => {
    const workspace = completeWorkspace();
    const imported = importWorkspaceBackup(exportWorkspaceBackup(workspace, 900));

    expect(imported).toEqual(workspace);
    expect(imported).not.toBe(workspace);
    expect(imported.accountMap).not.toBe(workspace.accountMap);
    expect(imported.portfolio.plans[0]?.items).not.toBe(workspace.portfolio.plans[0]?.items);
  });

  it.each([
    ['v1', retiredWorkspaceV1()],
    ['v2', retiredWorkspaceV2()],
  ])('imports a format-v1 retired %s workspace through the converter', (_label, retired) => {
    const imported = importWorkspaceBackup(envelope(1, retired));

    expect(imported).toMatchObject({
      schemaVersion: 3,
      updatedAt: 900,
      main: retired.main,
      portfolio: { plans: [completeWorkspace().portfolio.plans[0]], draft: null },
      locations: retired.locations,
    });
    expect(imported.accountMap).not.toHaveProperty('legacyPhaseA');
    if (imported.accountMap.applied === null) {
      expect(retired.schemaVersion).toBe(1);
    } else {
      expect(imported.accountMap.applied).not.toHaveProperty('layout');
    }
  });

  it('rejects every non-v3 workspace in a format-v2 envelope', () => {
    expect(() => importWorkspaceBackup(envelope(2, retiredWorkspaceV2())))
      .toThrow('backup-schema');
    expect(() => importWorkspaceBackup(envelope(2, retiredWorkspaceV1())))
      .toThrow('backup-schema');
  });

  it('preserves schema-versus-reference error classification on export and import', () => {
    const invalidSchema = {
      ...completeWorkspace(),
      main: {
        applied: { ...completeWorkspace().main.applied, monthlyNetIncomeWon: -1 },
        setupProgress: null,
      },
    } as WorkspaceDocument;
    const invalidReference = { ...completeWorkspace(), locations: [] };

    expect(errorCode(() => exportWorkspaceBackup(invalidSchema, 900))).toBe('backup-schema');
    expect(errorCode(() => exportWorkspaceBackup(invalidReference, 900))).toBe('backup-reference');
    expect(errorCode(() => importWorkspaceBackup(envelope(2, invalidSchema)))).toBe('backup-schema');
    expect(errorCode(() => importWorkspaceBackup(envelope(2, invalidReference))))
      .toBe('backup-reference');
    expect(errorCode(() => importWorkspaceBackup(envelope(1, {
      ...retiredWorkspaceV2(),
      locations: [],
    })))).toBe('backup-reference');
  });

  it.each([
    ['malformed JSON', '{bad', 'backup-json'],
    ['wrong format', JSON.stringify({
      format: 'main-backup',
      formatVersion: 2,
      exportedAt: 900,
      workspace: completeWorkspace(),
    }), 'backup-format'],
    ['unknown version', envelope(3, completeWorkspace()), 'backup-format'],
    ['extra envelope key', JSON.stringify({
      format: 'isf-workspace-backup',
      formatVersion: 2,
      exportedAt: 900,
      workspace: completeWorkspace(),
      extra: true,
    }), 'backup-format'],
    ['invalid exported timestamp', envelope(2, completeWorkspace(), -1), 'backup-schema'],
  ])('rejects %s with %s', (_label, text, expected) => {
    expect(errorCode(() => importWorkspaceBackup(text))).toBe(expected);
  });

  it('parses and converts without touching browser storage', () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);

    expect(importWorkspaceBackup(envelope(2, completeWorkspace()))).toEqual(completeWorkspace());
    expect(importWorkspaceBackup(envelope(1, retiredWorkspaceV2())).schemaVersion).toBe(3);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('classifies a deeply nested malformed format-v1 workspace as backup-schema', () => {
    expect(() => importWorkspaceBackup(deeplyNestedFormatV1Envelope(20_000)))
      .toThrow('backup-schema');
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

    expect(errorCode(() => exportWorkspaceBackup(mixedFailure, 900))).toBe('backup-schema');
    expect(errorCode(() => importWorkspaceBackup(envelope(2, mixedFailure))))
      .toBe('backup-schema');
  });
});
