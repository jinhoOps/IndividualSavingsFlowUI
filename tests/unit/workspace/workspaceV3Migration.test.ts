import { describe, expect, it } from 'vitest';
import {
  convertWorkspaceV3Document,
} from '../../../src/workspace/infrastructure/workspaceV3Migration';

const main = {
  schemaVersion: 2 as const,
  updatedAt: 100,
  monthlyNetIncomeWon: 3_000_000,
  monthlyHousingWon: 700_000,
  monthlyLivingWon: 900_000,
  monthlySavingWon: 400_000,
  monthlyInvestmentWon: 200_000,
};

const location = {
  id: 'loc-salary',
  shortName: '급여',
  kind: 'bank' as const,
  roles: ['income', 'spending', 'saving', 'investing'] as const,
  createdAt: 10,
  updatedAt: 20,
};

const applied = {
  schemaVersion: 2 as const,
  sourceMainUpdatedAt: 100,
  customPurposes: [],
  links: [{
    id: 'income-link',
    purposeId: 'system:income' as const,
    locationId: location.id,
    monthlyAmountWon: 3_000_000,
    remainder: false,
    status: 'active' as const,
    createdAt: 30,
    updatedAt: 30,
  }],
  setupCompletedAt: 300,
  updatedAt: 300,
};

const draft = {
  schemaVersion: 1 as const,
  sourceMainUpdatedAt: 100,
  customPurposes: [],
  links: [{
    id: 'income-link',
    purposeId: 'system:income' as const,
    locationId: location.id,
    monthlyAmountWon: 3_000_000,
    remainder: false,
    status: 'active' as const,
    createdAt: 30,
    updatedAt: 30,
  }],
  step: 'review' as const,
  updatedAt: 301,
};

function workspaceV3(): {
  schemaVersion: 3;
  revision: number;
  updatedAt: number;
  main: { applied: typeof main; setupProgress: null };
  simulation: { draft: null };
  portfolio: { plans: []; draft: null };
  locations: Array<Omit<typeof location, 'roles'> & { roles: string[] }>;
  accountMap: { applied: typeof applied | null; draft: typeof draft | null };
} {
  return {
    schemaVersion: 3 as const,
    revision: 4,
    updatedAt: 400,
    main: { applied: { ...main }, setupProgress: null },
    simulation: { draft: null },
    portfolio: { plans: [], draft: null },
    locations: [{ ...location, roles: [...location.roles] }],
    accountMap: {
      applied: { ...applied, links: applied.links.map((link) => ({ ...link })) },
      draft: { ...draft, links: draft.links.map((link) => ({ ...link })) },
    },
  };
}

describe('workspace v3 to v4 conversion', () => {
  it('preserves every nested v3 slice and source bytes while changing only the envelope generation', () => {
    const source = workspaceV3();
    const original = structuredClone(source);

    const result = convertWorkspaceV3Document(source, 500);

    expect(result.status).toBe('converted');
    if (result.status !== 'converted') throw new Error('expected converted workspace');
    expect(result).toMatchObject({ sourceVersion: 3 });
    expect(result.workspace.schemaVersion).toBe(4);
    expect(result.workspace.updatedAt).toBe(500);
    expect(result.workspace.accountMap).toEqual(source.accountMap);
    expect(result.workspace.main).toEqual(source.main);
    expect(result.workspace.simulation).toEqual(source.simulation);
    expect(result.workspace.portfolio).toEqual(source.portfolio);
    expect(result.workspace.locations).toEqual(source.locations);
    expect(source).toEqual(original);
  });

  it('accepts the historical applied-v2 and draft-v1 Account Map contracts without upgrading them', () => {
    const result = convertWorkspaceV3Document(workspaceV3(), 500);

    expect(result).toMatchObject({
      status: 'converted',
      workspace: {
        accountMap: {
          applied: { schemaVersion: 2 },
          draft: { schemaVersion: 1, step: 'review' },
        },
      },
    });
  });

  it('preserves a null Account Map without constructing a replacement state', () => {
    const source = workspaceV3();
    source.accountMap = { applied: null, draft: null };

    expect(convertWorkspaceV3Document(source, 500)).toMatchObject({
      status: 'converted',
      workspace: { accountMap: { applied: null, draft: null } },
    });
  });

  it.each([
    ['unknown schema version', (source: ReturnType<typeof workspaceV3>) => ({ ...source, schemaVersion: 4 })],
    ['extra historical envelope field', (source: ReturnType<typeof workspaceV3>) => ({ ...source, legacy: true })],
    ['future nested timestamp', (source: ReturnType<typeof workspaceV3>) => ({
      ...source,
      accountMap: {
        ...source.accountMap,
        applied: { ...source.accountMap.applied!, updatedAt: 501 },
      },
    })],
  ])('rejects %s without producing a partial candidate', (_label, mutate) => {
    expect(convertWorkspaceV3Document(mutate(workspaceV3()), 500))
      .toEqual({ status: 'invalid', reason: 'schema' });
  });

  it('rejects invalid references independently of envelope validity', () => {
    const source = workspaceV3();
    source.locations = [];

    expect(convertWorkspaceV3Document(source, 500))
      .toEqual({ status: 'invalid', reason: 'reference' });
  });

  it('returns the same valid conversion every time without mutating the v3 source', () => {
    const source = workspaceV3();
    const original = structuredClone(source);

    expect(convertWorkspaceV3Document(source, 500)).toEqual(convertWorkspaceV3Document(source, 500));
    expect(source).toEqual(original);
  });
});
