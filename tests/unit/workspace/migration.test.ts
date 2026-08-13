import { describe, expect, it } from 'vitest';
import type { MonthlyFlow } from '../../../src/workspace/domain/accountMapContract';
import { migrateWorkspaceV1, parseWorkspaceDocumentVersioned } from '../../../src/workspace/domain/migration';
import type { WorkspaceDocumentV1, WorkspaceDocumentV2 } from '../../../src/workspace/domain/model';

const legacyFlow: MonthlyFlow = {
  id: 'flow-1',
  source: { type: 'location', id: 'loc-1' },
  target: { type: 'location', id: 'loc-1' },
  purpose: 'income',
  monthlyAmountWon: 3_000_000,
  createdAt: 10,
  updatedAt: 10,
};

function legacyWorkspace(): WorkspaceDocumentV1 {
  return {
    schemaVersion: 1,
    revision: 4,
    updatedAt: 100,
    main: {
      applied: {
        schemaVersion: 2,
        updatedAt: 100,
        monthlyNetIncomeWon: 3_000_000,
        monthlyHousingWon: 700_000,
        monthlyLivingWon: 900_000,
        monthlySavingWon: 400_000,
        monthlyInvestmentWon: 200_000,
      },
      setupProgress: null,
    },
    simulation: { draft: null },
    portfolio: { plans: [], draft: null },
    locations: [{
      id: 'loc-1',
      shortName: '급여',
      institution: { id: 'kb-kookmin', name: 'KB국민은행' },
      kind: 'bank',
      roles: ['income'],
      createdAt: 10,
      updatedAt: 10,
    }],
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  };
}

function currentWorkspace(): WorkspaceDocumentV2 {
  return migrateWorkspaceV1(legacyWorkspace(), 200);
}

describe('Workspace v1 to v2 migration', () => {
  it('preserves protected slices and moves Phase A values into compatibility storage', () => {
    const legacy = legacyWorkspace();
    legacy.accountMap.flows = [legacyFlow];

    const migrated = migrateWorkspaceV1(legacy, 200);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.updatedAt).toBe(200);
    expect(migrated.main).toEqual(legacy.main);
    expect(migrated.simulation).toEqual(legacy.simulation);
    expect(migrated.portfolio).toEqual(legacy.portfolio);
    expect(migrated.locations).toEqual(legacy.locations);
    expect(migrated.accountMap).toEqual({
      applied: null,
      draft: null,
      legacyPhaseA: { instruments: [], flows: [legacyFlow] },
    });
  });

  it('parses both exact versions without treating unknown versions as current', () => {
    expect(parseWorkspaceDocumentVersioned(legacyWorkspace())).toMatchObject({ version: 1 });
    expect(parseWorkspaceDocumentVersioned(currentWorkspace())).toMatchObject({ version: 2 });
    expect(parseWorkspaceDocumentVersioned({ ...currentWorkspace(), schemaVersion: 3 })).toBeNull();
  });

  it('rejects duplicate links, active archived references, role mismatches, and two remainders', () => {
    const base = currentWorkspace();
    const activeLink = {
      id: 'link-1',
      purposeId: 'system:income' as const,
      locationId: 'loc-1',
      monthlyAmountWon: 3_000_000,
      remainder: true,
      status: 'active' as const,
      createdAt: 10,
      updatedAt: 10,
    };
    const applied = {
      schemaVersion: 1 as const,
      sourceMainUpdatedAt: 100,
      customPurposes: [],
      links: [activeLink],
      layout: 'purpose' as const,
      setupCompletedAt: 10,
      updatedAt: 10,
    };

    expect(parseWorkspaceDocumentVersioned({
      ...base,
      accountMap: { ...base.accountMap, applied: { ...applied, links: [activeLink, activeLink] } },
    })).toBeNull();
    expect(parseWorkspaceDocumentVersioned({
      ...base,
      locations: [{ ...base.locations[0], archivedAt: 20 }],
      accountMap: { ...base.accountMap, applied },
    })).toBeNull();
    expect(parseWorkspaceDocumentVersioned({
      ...base,
      locations: [{ ...base.locations[0], roles: ['spending'] }],
      accountMap: { ...base.accountMap, applied },
    })).toBeNull();
    expect(parseWorkspaceDocumentVersioned({
      ...base,
      locations: [...base.locations, { ...base.locations[0], id: 'loc-2', shortName: '급여2' }],
      accountMap: {
        ...base.accountMap,
        applied: { ...applied, links: [activeLink, { ...activeLink, id: 'link-2', locationId: 'loc-2' }] },
      },
    })).toBeNull();
  });

  it('keeps an applied custom target readable after Main decreases below it', () => {
    const base = currentWorkspace();
    const applied = {
      schemaVersion: 1 as const,
      sourceMainUpdatedAt: 100,
      customPurposes: [{
        id: 'custom:telecom' as const,
        parentId: 'system:living' as const,
        name: '통신비',
        targetMonthlyWon: 1_000_000,
        createdAt: 10,
        updatedAt: 10,
      }],
      links: [],
      layout: 'purpose' as const,
      setupCompletedAt: 10,
      updatedAt: 10,
    };

    expect(parseWorkspaceDocumentVersioned({
      ...base,
      main: {
        ...base.main,
        applied: { ...base.main.applied!, monthlyLivingWon: 900_000, updatedAt: 110 },
      },
      accountMap: { ...base.accountMap, applied },
    })).toMatchObject({ version: 2 });
  });
});
