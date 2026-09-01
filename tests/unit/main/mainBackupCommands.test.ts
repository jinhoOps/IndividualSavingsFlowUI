import { describe, expect, it, vi } from 'vitest';
import {
  createWorkspaceBackupExport,
  parseWorkspaceBackupCandidate,
  restoreWorkspaceBackup,
} from '../../../src/main/application/mainBackupCommands';
import type { MainRepository } from '../../../src/main/infrastructure/mainRepository';
import type { WorkspaceDocument } from '../../../src/workspace/domain/model';
import type { WorkspaceRepository } from '../../../src/workspace/infrastructure/workspaceRepository';

function workspace(monthlyNetIncomeWon: number, revision = 1): WorkspaceDocument {
  const applied = {
    schemaVersion: 2 as const,
    updatedAt: 100,
    monthlyNetIncomeWon,
    monthlyHousingWon: 900_000,
    monthlyLivingWon: 700_000,
    monthlySavingWon: 500_000,
    monthlyInvestmentWon: 400_000,
  };
  return {
    schemaVersion: 2,
    revision,
    updatedAt: 500,
    main: { applied, setupProgress: null },
    simulation: {
      draft: {
        schemaVersion: 3,
        source: {
          monthlySavingsWon: applied.monthlySavingWon,
          monthlyInvestmentWon: applied.monthlyInvestmentWon,
          mainUpdatedAt: applied.updatedAt,
        },
        initialInvestmentWon: 2_000_000,
        targetAmountWon: 100_000_000,
        years: 20,
        expectedAnnualReturnPercent: 8,
        baseRatePercent: 2.5,
        inflationOffsetPercentPoints: -0.5,
        amountMode: 'nominal',
        updatedAt: 200,
      },
    },
    portfolio: {
      plans: [{
        schemaVersion: 2,
        scope: { type: 'location', locationId: 'loc-isa' },
        items: [{
          id: 'asset-us', name: '미국 인덱스', shareUnits: 700_000, order: 0,
          classification: 'growth', classificationOrigin: 'automatic',
        }],
        cashShareUnits: 300_000,
        cashMode: 'automatic',
        syncedInvestmentWon: applied.monthlyInvestmentWon,
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
    accountMap: { applied: null, draft: null, legacyPhaseA: { instruments: [], flows: [] } },
  };
}

function backupEnvelope(value: WorkspaceDocument): string {
  return JSON.stringify({
    format: 'isf-workspace-backup',
    formatVersion: 1,
    exportedAt: 900,
    workspace: value,
  });
}

function repository(result: Awaited<ReturnType<MainRepository['load']>>): MainRepository {
  return {
    load: async () => result,
    save: async (draft) => draft,
    saveSetupProgress: async () => undefined,
    loadSetupProgress: () => null,
    clearSetupProgress: async () => undefined,
    resetInvalidWorkspace: async () => undefined,
  };
}

describe('main backup commands', () => {
  it('rejects every invalid candidate before a workspace write', () => {
    expect(parseWorkspaceBackupCandidate('{')).toEqual({
      status: 'candidate-invalid',
      reason: 'json',
    });
    expect(parseWorkspaceBackupCandidate(JSON.stringify({ schemaVersion: 2 }))).toEqual({
      status: 'candidate-invalid',
      reason: 'format',
    });
    expect(parseWorkspaceBackupCandidate(backupEnvelope({
      ...workspace(900),
      locations: [],
    }))).toEqual({ status: 'candidate-invalid', reason: 'reference' });
    expect(parseWorkspaceBackupCandidate(backupEnvelope({
      ...workspace(900),
      accountMap: {
        applied: null,
        draft: null,
        legacyPhaseA: { instruments: [{ id: 'broken' }], flows: [] },
      },
    } as unknown as WorkspaceDocument))).toEqual({ status: 'candidate-invalid', reason: 'schema' });
  });

  it('exports only a valid loaded workspace', () => {
    const current = workspace(900, 12);
    const result = createWorkspaceBackupExport({
      load: () => ({ status: 'found', workspace: current, needsMigration: false }),
    });
    expect(result).toMatchObject({ status: 'ready' });
    if (result.status === 'ready') {
      expect(parseWorkspaceBackupCandidate(result.contents)).toEqual({
        status: 'ready',
        candidate: current,
      });
    }
    expect(createWorkspaceBackupExport({
      load: () => ({ status: 'invalid', raw: '{broken' }),
    })).toEqual({ status: 'current-invalid' });
    expect(createWorkspaceBackupExport({
      load: () => ({ status: 'unavailable' }),
    })).toEqual({ status: 'unavailable' });
  });

  it('returns a failed export result when serialization throws', () => {
    // A malformed timestamp makes the real exporter reject the workspace envelope.
    const result = createWorkspaceBackupExport({
      load: () => ({ status: 'found', workspace: { ...workspace(900), updatedAt: Number.NaN }, needsMigration: false }),
    });
    expect(result).toEqual({ status: 'failed', error: expect.any(Error) });
  });

  it('uses the loaded revision once, replaces atomically, then bootstraps Main', async () => {
    const candidate = workspace(900, 12);
    const replaced = workspace(900, 6);
    const workspaceRepository = {
      load: vi.fn(() => ({
        status: 'found' as const,
        workspace: workspace(300, 5),
        needsMigration: false as const,
      })),
      replace: vi.fn(async () => ({ status: 'saved' as const, workspace: replaced })),
    };
    const mainRepository = repository({
      status: 'current',
      data: candidate.main.applied!,
      original: candidate.main.applied!,
    });

    const result = await restoreWorkspaceBackup(candidate, workspaceRepository, mainRepository);

    expect(workspaceRepository.replace).toHaveBeenCalledWith(5, candidate);
    expect(result.status).toBe('restored');
    if (result.status === 'restored') {
      expect(result.bootstrap.state.applied?.monthlyNetIncomeWon).toBe(900);
    }
  });

  it.each([
    ['conflict', { status: 'conflict', currentRevision: 6 }, { status: 'conflict' }],
    ['candidate invalid', { status: 'invalid' }, { status: 'candidate-invalid', reason: 'schema' }],
    ['replace unavailable', { status: 'unavailable' }, { status: 'unavailable', stage: 'replace' }],
  ] as const)('maps %s replacement without bootstrapping', async (_label, writeResult, expected) => {
    const replace = vi.fn(async () => writeResult);
    const result = await restoreWorkspaceBackup(workspace(900), {
      load: () => ({ status: 'found', workspace: workspace(300, 5), needsMigration: false }),
      replace,
    }, repository({ status: 'empty', data: null, original: null }));
    expect(result).toEqual(expected);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['invalid current workspace', () => ({ status: 'invalid' as const, raw: '{bad' }), { status: 'current-invalid' }],
    ['unavailable current workspace', () => ({ status: 'unavailable' as const }), { status: 'unavailable', stage: 'load' }],
  ])('does not replace a %s', async (_label, load, expected) => {
    const replace = vi.fn();
    await expect(restoreWorkspaceBackup(workspace(900), { load, replace }, repository({ status: 'empty', data: null, original: null })))
      .resolves.toEqual(expected);
    expect(replace).not.toHaveBeenCalled();
  });

  it('returns unexpected repository failures as errors', async () => {
    const error = new Error('storage exploded');
    await expect(restoreWorkspaceBackup(workspace(900), {
      load: () => { throw error; },
      replace: vi.fn(),
    }, repository({ status: 'empty', data: null, original: null }))).resolves.toEqual({ status: 'failed', error });
  });
});
