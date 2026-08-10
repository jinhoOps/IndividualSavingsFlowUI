import { describe, expect, it } from 'vitest';
import {
  parseConsumerInstrument,
  parseMonthlyFlow,
  type ConsumerInstrument,
  type MonthlyFlow,
} from '../../../src/workspace/domain/accountMapContract';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';
import type { FinancialLocation, FinancialRole } from '../../../src/workspace/domain/financialLocation';
import {
  parseWorkspaceDocument,
  validateWorkspaceCrossReferences,
} from '../../../src/workspace/domain/validation';

const validMain = {
  schemaVersion: 2,
  updatedAt: 100,
  monthlyNetIncomeWon: 3_000_000,
  monthlyHousingWon: 700_000,
  monthlyLivingWon: 900_000,
  monthlySavingWon: 400_000,
  monthlyInvestmentWon: 200_000,
};

const validSimulation = {
  schemaVersion: 2,
  source: {
    monthlySavingsWon: 400_000,
    monthlyInvestmentWon: 200_000,
    mainUpdatedAt: 100,
  },
  initialInvestmentWon: 0,
  years: 20,
  expectedAnnualReturnPercent: 9,
  baseRatePercent: 2.75,
  inflationOffsetPercentPoints: -0.25,
  amountMode: 'nominal',
  updatedAt: 200,
};

const aggregatePlan = {
  schemaVersion: 2,
  scope: { type: 'aggregate' },
  items: [{ id: 'asset-1', name: '미국 인덱스', shareUnits: 800_000, order: 0 }],
  cashShareUnits: 200_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 300,
  updatedAt: 300,
};

const investingLocation = {
  id: 'loc-isa',
  shortName: 'ISA',
  kind: 'brokerage',
  roles: ['investing'],
  createdAt: 10,
  updatedAt: 20,
};

function validWorkspace() {
  return {
    schemaVersion: 1,
    revision: 4,
    updatedAt: 400,
    main: {
      applied: { ...validMain },
      setupProgress: {
        kind: 'restart',
        step: 'review',
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
      applied: null,
      draft: null,
      instruments: [] as unknown[],
      flows: [] as unknown[],
    },
  };
}

function location(index: number, roles: FinancialRole[], archivedAt?: number): FinancialLocation {
  return {
    id: `loc-${index}`,
    shortName: `L${index}`,
    kind: 'bank',
    roles,
    ...(archivedAt === undefined ? {} : { archivedAt }),
    createdAt: 10,
    updatedAt: 20,
  };
}

const validInstrument: ConsumerInstrument = {
  id: 'card-1',
  shortName: '생활비',
  type: 'credit',
  fundingLocationId: investingLocation.id,
  createdAt: 100,
  updatedAt: 200,
};

const validFlow: MonthlyFlow = {
  id: 'flow-1',
  source: { type: 'location', id: investingLocation.id },
  target: { type: 'instrument', id: validInstrument.id },
  purpose: 'spending',
  monthlyAmountWon: 500_000,
  createdAt: 100,
  updatedAt: 200,
};

function crossReferenceWorkspace(): WorkspaceDocument {
  const workspace = parseWorkspaceDocument(validWorkspace());
  if (workspace === null) throw new Error('expected valid workspace fixture');
  return workspace;
}

describe('Workspace validation', () => {
  it('creates an exact empty workspace at revision zero', () => {
    expect(createEmptyWorkspace(100)).toEqual({
      schemaVersion: 1,
      revision: 0,
      updatedAt: 100,
      main: { applied: null, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null, instruments: [], flows: [] },
    });
  });

  it('returns null instead of overflowing on a deeply malformed Main slice', () => {
    let malformedMain: unknown = null;
    for (let depth = 0; depth < 20_000; depth += 1) {
      malformedMain = { nested: malformedMain };
    }

    expect(parseWorkspaceDocument({
      ...createEmptyWorkspace(100),
      main: malformedMain,
    })).toBeNull();
  });

  it('parses one exact current workspace and deeply reconstructs it', () => {
    const original = validWorkspace();
    const parsed = parseWorkspaceDocument(original);

    expect(parsed).toEqual(original);
    expect(parsed).not.toBe(original);
    expect(parsed?.main).not.toBe(original.main);
    expect(parsed?.main.applied).not.toBe(original.main.applied);
    expect(parsed?.main.setupProgress?.draft).not.toBe(original.main.setupProgress.draft);
    expect(parsed?.simulation.draft?.source).not.toBe(original.simulation.draft.source);
    expect(parsed?.portfolio.plans).not.toBe(original.portfolio.plans);
    expect(parsed?.portfolio.plans[0]?.items).not.toBe(original.portfolio.plans[0].items);
    expect(parsed?.locations[0]?.roles).not.toBe(original.locations[0].roles);
  });

  it.each([
    ['root', (workspace: ReturnType<typeof validWorkspace>) => ({ ...workspace, extra: true })],
    ['main slice', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      main: { ...workspace.main, extra: true },
    })],
    ['simulation slice', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      simulation: { ...workspace.simulation, extra: true },
    })],
    ['portfolio slice', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      portfolio: { ...workspace.portfolio, extra: true },
    })],
    ['account-map slice', (workspace: ReturnType<typeof validWorkspace>) => ({
      ...workspace,
      accountMap: { ...workspace.accountMap, extra: true },
    })],
  ])('rejects extra keys on the %s', (_name, addExtraKey) => {
    expect(parseWorkspaceDocument(addExtraKey(validWorkspace()))).toBeNull();
  });

  it('rejects a symbol own key on nested applied Main data', () => {
    const workspace = validWorkspace();
    workspace.main.applied = { ...validMain, [Symbol('extra')]: true };

    expect(parseWorkspaceDocument(workspace)).toBeNull();
  });

  it('rejects a symbol own key on nested Main setup draft data', () => {
    const workspace = validWorkspace();
    workspace.main.setupProgress.draft = { ...validMain, [Symbol('extra')]: true };

    expect(parseWorkspaceDocument(workspace)).toBeNull();
  });

  it('rejects a symbol own key on a nested Simulation draft', () => {
    const workspace = validWorkspace();
    workspace.simulation.draft = { ...validSimulation, [Symbol('extra')]: true };

    expect(parseWorkspaceDocument(workspace)).toBeNull();
  });

  it('rejects a symbol own key on a nested Simulation source', () => {
    const workspace = validWorkspace();
    workspace.simulation.draft.source = {
      ...validSimulation.source,
      [Symbol('extra')]: true,
    };

    expect(parseWorkspaceDocument(workspace)).toBeNull();
  });

  it('rejects old app-only and v1 Portfolio values', () => {
    expect(parseWorkspaceDocument(validMain)).toBeNull();
    expect(parseWorkspaceDocument(validSimulation)).toBeNull();
    const workspace = validWorkspace();
    const { scope: _scope, ...validPlanV1 } = aggregatePlan;
    expect(parseWorkspaceDocument({
      ...workspace,
      portfolio: {
        ...workspace.portfolio,
        plans: [{ ...validPlanV1, schemaVersion: 1 }],
      },
    })).toBeNull();
  });

  it('requires unique Portfolio plan scopes', () => {
    const workspace = validWorkspace();
    workspace.portfolio.plans.push({
      ...aggregatePlan,
      items: [],
      cashShareUnits: 1_000_000,
      appliedAt: 301,
      updatedAt: 301,
    });

    expect(parseWorkspaceDocument(workspace)).toBeNull();
  });

  it('preserves existing location-scoped Portfolio references across role removal and archive', () => {
    const scopedPlan = {
      ...aggregatePlan,
      scope: { type: 'location', locationId: investingLocation.id },
    };
    const { appliedAt: _appliedAt, ...scopedPlanCommon } = scopedPlan;
    const scopedDraft = {
      ...scopedPlanCommon,
      inputMode: 'amount',
      isApplicable: true,
    };
    const workspace = validWorkspace();
    workspace.portfolio.plans = [scopedPlan];

    expect(parseWorkspaceDocument({
      ...workspace,
      portfolio: { plans: [scopedPlan], draft: scopedDraft },
      locations: [{ ...investingLocation, roles: ['saving'] }],
    })).not.toBeNull();
    expect(parseWorkspaceDocument({
      ...workspace,
      portfolio: { plans: [scopedPlan], draft: scopedDraft },
      locations: [{ ...investingLocation, archivedAt: 30 }],
    })).not.toBeNull();
  });

  it('continues to reject a missing location ID from a location-scoped Portfolio reference', () => {
    const scopedPlan = {
      ...aggregatePlan,
      scope: { type: 'location', locationId: investingLocation.id },
    };
    const workspace = validWorkspace();
    workspace.portfolio.plans = [scopedPlan];

    expect(parseWorkspaceDocument(workspace)).not.toBeNull();
    expect(parseWorkspaceDocument({ ...workspace, locations: [] })).toBeNull();
  });

  it('rejects a draft-only Portfolio scope whose location ID is missing from the registry', () => {
    const { appliedAt: _appliedAt, ...scopedPlanCommon } = {
      ...aggregatePlan,
      scope: { type: 'location', locationId: 'missing-location' },
    };
    const workspace = validWorkspace();

    expect(parseWorkspaceDocument({
      ...workspace,
      portfolio: {
        plans: [],
        draft: { ...scopedPlanCommon, inputMode: 'amount', isApplicable: true },
      },
    })).toBeNull();
  });

  it('rejects duplicate active normalized location names', () => {
    const workspace = validWorkspace();
    workspace.locations = [
      { ...investingLocation, id: 'loc-a', shortName: '  Toss   ISA ' },
      { ...investingLocation, id: 'loc-b', shortName: 'toss isa' },
    ];

    expect(parseWorkspaceDocument(workspace)).toBeNull();
  });

  it.each(['income', 'spending', 'saving', 'investing'] as const)
    ('enforces the active %s location capacity', (role) => {
      const workspace = validWorkspace();
      workspace.portfolio.plans = [];
      workspace.locations = Array.from({ length: 11 }, (_, index) => location(index, [role]));

      expect(parseWorkspaceDocument(workspace)).toBeNull();
    });

  it.each(['income', 'spending', 'saving', 'investing'] as const)
    ('keeps archived %s locations valid without counting them toward capacity', (role) => {
      const workspace = validWorkspace();
      workspace.portfolio.plans = [];
      workspace.locations = [
        ...Array.from({ length: 10 }, (_, index) => location(index, [role])),
        location(10, [role], 30),
      ];

      expect(parseWorkspaceDocument(workspace)).not.toBeNull();
    });

  it('parses exact Account Map instrument and flow primitives as independent values', () => {
    expect(parseConsumerInstrument(validInstrument)).toEqual(validInstrument);
    expect(parseMonthlyFlow(validFlow)).toEqual(validFlow);
    expect(parseMonthlyFlow(validFlow)?.source).not.toBe(validFlow.source);
    expect(parseMonthlyFlow(validFlow)?.target).not.toBe(validFlow.target);
    expect(parseConsumerInstrument({ ...validInstrument, extra: true })).toBeNull();
    expect(parseMonthlyFlow({ ...validFlow, extra: true })).toBeNull();
  });

  it('validates resolved Account Map references before the Phase A empty-only gate', () => {
    const workspace = crossReferenceWorkspace();
    workspace.accountMap.instruments = [{ ...validInstrument }];
    workspace.accountMap.flows = [{
      ...validFlow,
      source: { ...validFlow.source },
      target: { ...validFlow.target },
    }];

    expect(validateWorkspaceCrossReferences(workspace)).toBe(true);
  });

  it.each([
    ['instrument', (workspace: WorkspaceDocument) => {
      workspace.accountMap.instruments = [{ ...validInstrument }];
    }],
    ['flow', (workspace: WorkspaceDocument) => {
      workspace.accountMap.flows = [{
        ...validFlow,
        source: { type: 'location', id: investingLocation.id },
        target: { type: 'location', id: investingLocation.id },
      }];
    }],
  ] as const)('rejects a non-empty persisted Account Map %s in Phase A', (_kind, populate) => {
    const workspace = crossReferenceWorkspace();
    populate(workspace);

    expect(validateWorkspaceCrossReferences(workspace)).toBe(true);
    expect(parseWorkspaceDocument(workspace)).toBeNull();
  });

  it('rejects a missing consumer-instrument funding location independently', () => {
    const workspace = crossReferenceWorkspace();
    workspace.accountMap.instruments = [{ ...validInstrument, fundingLocationId: 'missing' }];

    expect(validateWorkspaceCrossReferences(workspace)).toBe(false);
  });

  it('rejects a missing flow source endpoint independently', () => {
    const workspace = crossReferenceWorkspace();
    workspace.accountMap.instruments = [{ ...validInstrument }];
    workspace.accountMap.flows = [{
      ...validFlow,
      source: { type: 'location', id: 'missing' },
      target: { ...validFlow.target },
    }];

    expect(validateWorkspaceCrossReferences(workspace)).toBe(false);
  });

  it('rejects a missing flow target endpoint independently', () => {
    const workspace = crossReferenceWorkspace();
    workspace.accountMap.instruments = [{ ...validInstrument }];
    workspace.accountMap.flows = [{
      ...validFlow,
      source: { ...validFlow.source },
      target: { type: 'instrument', id: 'missing' },
    }];

    expect(validateWorkspaceCrossReferences(workspace)).toBe(false);
  });

  it.each([
    ['location', (workspace: WorkspaceDocument) => {
      workspace.locations.push({
        ...workspace.locations[0],
        shortName: 'Second',
        roles: [...workspace.locations[0].roles],
      });
    }],
    ['instrument', (workspace: WorkspaceDocument) => {
      workspace.accountMap.instruments = [
        { ...validInstrument },
        { ...validInstrument, shortName: '예비카드' },
      ];
    }],
    ['flow', (workspace: WorkspaceDocument) => {
      workspace.accountMap.instruments = [{ ...validInstrument }];
      workspace.accountMap.flows = [
        { ...validFlow, source: { ...validFlow.source }, target: { ...validFlow.target } },
        { ...validFlow, source: { ...validFlow.source }, target: { ...validFlow.target } },
      ];
    }],
  ] as const)('rejects a duplicate %s ID independently', (_kind, addDuplicate) => {
    const workspace = crossReferenceWorkspace();
    addDuplicate(workspace);

    expect(validateWorkspaceCrossReferences(workspace)).toBe(false);
  });

  it('counts active instruments with active spending locations for combined capacity', () => {
    const workspace = crossReferenceWorkspace();
    workspace.locations.push(...Array.from(
      { length: 9 },
      (_, index) => location(index + 20, ['spending']),
    ));
    workspace.accountMap.instruments = [{ ...validInstrument }];
    expect(validateWorkspaceCrossReferences(workspace)).toBe(true);

    workspace.accountMap.instruments.push({
      ...validInstrument,
      id: 'card-2',
      shortName: '예비카드',
    });
    expect(validateWorkspaceCrossReferences(workspace)).toBe(false);
  });
});
