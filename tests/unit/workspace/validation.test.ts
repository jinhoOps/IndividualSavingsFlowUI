import { describe, expect, it } from 'vitest';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';
import {
  parseWorkspaceDocument,
  validateWorkspaceDocument,
} from '../../../src/workspace/domain/validation';

const validMain = {
  schemaVersion: 2 as const,
  updatedAt: 100,
  monthlyNetIncomeWon: 3_000_000,
  monthlyHousingWon: 700_000,
  monthlyLivingWon: 900_000,
  monthlySavingWon: 400_000,
  monthlyInvestmentWon: 200_000,
};

const validSimulation = {
  schemaVersion: 3 as const,
  source: {
    monthlySavingsWon: 400_000,
    monthlyInvestmentWon: 200_000,
    mainUpdatedAt: 100,
  },
  initialInvestmentWon: 0,
  targetAmountWon: 100_000_000,
  years: 20,
  expectedAnnualReturnPercent: 9,
  baseRatePercent: 2.75,
  inflationOffsetPercentPoints: -0.25,
  amountMode: 'nominal' as const,
  updatedAt: 200,
};

const aggregatePlan = {
  schemaVersion: 2 as const,
  scope: { type: 'aggregate' as const },
  items: [{
    id: 'asset-1',
    name: '미국 인덱스',
    shareUnits: 800_000,
    order: 0,
    classification: 'growth' as const,
    classificationOrigin: 'automatic' as const,
  }],
  cashShareUnits: 200_000,
  cashMode: 'automatic' as const,
  syncedInvestmentWon: 200_000,
  appliedAt: 300,
  updatedAt: 300,
};

const investingLocation = {
  id: 'loc-isa',
  shortName: 'ISA',
  kind: 'brokerage' as const,
  roles: ['investing' as const],
  createdAt: 10,
  updatedAt: 20,
};

const investingLink = {
  id: 'link-investing',
  purposeId: 'system:investing' as const,
  locationId: investingLocation.id,
  monthlyAmountWon: 200_000,
  remainder: true as const,
  status: 'active' as const,
  createdAt: 30,
  updatedAt: 30,
};

function validWorkspace() {
  return {
    schemaVersion: 3 as const,
    revision: 4,
    updatedAt: 400,
    main: {
      applied: { ...validMain },
      setupProgress: {
        kind: 'restart' as const,
        step: 'review' as const,
        draft: { ...validMain },
        savedAt: 150,
      },
    },
    simulation: {
      draft: { ...validSimulation, source: { ...validSimulation.source } },
    },
    portfolio: {
      plans: [{
        ...aggregatePlan,
        scope: { ...aggregatePlan.scope },
        items: aggregatePlan.items.map((item) => ({ ...item })),
      }],
      draft: null,
    },
    locations: [{ ...investingLocation, roles: [...investingLocation.roles] }],
    accountMap: {
      applied: {
        schemaVersion: 2 as const,
        sourceMainUpdatedAt: 100,
        customPurposes: [],
        links: [{ ...investingLink }],
        setupCompletedAt: 300,
        updatedAt: 300,
      },
      draft: null,
    },
  };
}

describe('Workspace v3 validation', () => {
  it('creates and parses an exact current empty workspace', () => {
    expect(parseWorkspaceDocument(createEmptyWorkspace(100))).toMatchObject({
      schemaVersion: 3,
      revision: 0,
      updatedAt: 100,
      accountMap: { applied: null, draft: null },
    });
    expect(createEmptyWorkspace(100).accountMap).toEqual({ applied: null, draft: null });
  });

  it('deeply reconstructs the current document instead of returning caller objects', () => {
    const original = validWorkspace();
    const parsed = parseWorkspaceDocument(original);

    expect(parsed).toEqual(original);
    expect(parsed).not.toBe(original);
    expect(parsed?.main.applied).not.toBe(original.main.applied);
    expect(parsed?.main.setupProgress?.draft).not.toBe(original.main.setupProgress.draft);
    expect(parsed?.simulation.draft?.source).not.toBe(original.simulation.draft.source);
    expect(parsed?.portfolio.plans[0]?.items).not.toBe(original.portfolio.plans[0]?.items);
    expect(parsed?.locations[0]?.roles).not.toBe(original.locations[0]?.roles);
    expect(parsed?.accountMap.applied?.links).not.toBe(original.accountMap.applied.links);
  });

  it.each([
    ['root', (workspace: ReturnType<typeof validWorkspace>) => ({ ...workspace, extra: true })],
    ['main', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      main: { ...workspace.main, extra: true },
    })],
    ['simulation', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      simulation: { ...workspace.simulation, extra: true },
    })],
    ['portfolio', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      portfolio: { ...workspace.portfolio, extra: true },
    })],
    ['account map', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      accountMap: { ...workspace.accountMap, extra: true },
    })],
  ])('rejects an extra key on the %s slice', (_label, mutate) => {
    expect(parseWorkspaceDocument(mutate(validWorkspace()))).toBeNull();
  });

  it('rejects retired Account Map compatibility fields instead of stripping them', () => {
    const empty = createEmptyWorkspace(100);
    expect(parseWorkspaceDocument({
      ...empty,
      accountMap: {
        applied: null,
        draft: null,
        legacyPhaseA: { instruments: [], flows: [] },
      },
    })).toBeNull();

    const workspace = validWorkspace();
    expect(parseWorkspaceDocument({
      ...workspace,
      accountMap: {
        ...workspace.accountMap,
        applied: { ...workspace.accountMap.applied, layout: 'account' },
      },
    })).toBeNull();
  });

  it('rejects location-scoped Portfolio state in the current contract', () => {
    const workspace = validWorkspace();
    expect(parseWorkspaceDocument({
      ...workspace,
      portfolio: {
        plans: [{ ...aggregatePlan, scope: { type: 'location', locationId: 'loc-isa' } }],
        draft: null,
      },
    })).toBeNull();
  });

  it.each([1, 2])('rejects a retired Simulation v%i draft in current state', (schemaVersion) => {
    const workspace = validWorkspace();
    const { targetAmountWon: _targetAmountWon, ...retiredDraft } = validSimulation;
    expect(parseWorkspaceDocument({
      ...workspace,
      simulation: { draft: { ...retiredDraft, schemaVersion } },
    })).toBeNull();
  });

  it('classifies invalid shapes as schema failures', () => {
    const workspace = validWorkspace();
    expect(validateWorkspaceDocument({ ...workspace, schemaVersion: 4 })).toEqual({ status: 'schema' });
    expect(validateWorkspaceDocument({
      ...workspace,
      accountMap: {
        ...workspace.accountMap,
        applied: { ...workspace.accountMap.applied, schemaVersion: 1 },
      },
    })).toEqual({ status: 'schema' });
    expect(validateWorkspaceDocument({ ...workspace, updatedAt: 8_640_000_000_000_001 }))
      .toEqual({ status: 'schema' });
  });

  it.each([
    ['duplicate location identifiers', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      locations: [...workspace.locations, { ...workspace.locations[0], shortName: 'ISA 2' }],
    })],
    ['duplicate normalized active location names', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      locations: [...workspace.locations, {
        ...workspace.locations[0], id: 'loc-2', shortName: ' isa ',
      }],
    })],
    ['missing link location', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      locations: [],
    })],
    ['duplicate plan scopes', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      portfolio: { plans: [...workspace.portfolio.plans, aggregatePlan], draft: null },
    })],
    ['future Main source', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      accountMap: {
        ...workspace.accountMap,
        applied: { ...workspace.accountMap.applied, sourceMainUpdatedAt: 101 },
      },
    })],
  ])('classifies %s as a reference failure', (_label, mutate) => {
    expect(validateWorkspaceDocument(mutate(validWorkspace()))).toEqual({ status: 'reference' });
  });

  it('rejects duplicate Account Map identifiers and relationship pairs', () => {
    const workspace = validWorkspace();
    const duplicatePurpose = {
      id: 'custom:trip' as const,
      parentId: 'system:living' as const,
      name: '여행',
      targetMonthlyWon: 100_000,
      createdAt: 10,
      updatedAt: 10,
    };
    const applied = workspace.accountMap.applied;
    expect(validateWorkspaceDocument({
      ...workspace,
      accountMap: {
        applied: {
          ...applied,
          customPurposes: [duplicatePurpose, duplicatePurpose],
        },
        draft: null,
      },
    })).toEqual({ status: 'reference' });
    expect(validateWorkspaceDocument({
      ...workspace,
      accountMap: {
        applied: { ...applied, links: [investingLink, { ...investingLink, id: 'link-2' }] },
        draft: null,
      },
    })).toEqual({ status: 'reference' });
  });

  it('returns null instead of overflowing on a deeply malformed Main slice', () => {
    let malformedMain: unknown = null;
    for (let depth = 0; depth < 20_000; depth += 1) malformedMain = { nested: malformedMain };
    expect(parseWorkspaceDocument({ ...createEmptyWorkspace(100), main: malformedMain })).toBeNull();
  });
});
