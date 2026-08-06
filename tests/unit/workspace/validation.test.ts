import { describe, expect, it } from 'vitest';
import {
  parseConsumerInstrument,
  parseMonthlyFlow,
} from '../../../src/workspace/domain/accountMapContract';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';
import { parseWorkspaceDocument } from '../../../src/workspace/domain/validation';

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
      applied: validMain,
      setupProgress: {
        kind: 'restart',
        step: 'review',
        draft: validMain,
        savedAt: 150,
      },
    },
    simulation: { draft: validSimulation },
    portfolio: { plans: [aggregatePlan], draft: null },
    locations: [investingLocation],
    accountMap: {
      applied: null,
      draft: null,
      instruments: [] as unknown[],
      flows: [] as unknown[],
    },
  };
}

function location(index: number, roles: string[], archivedAt?: number) {
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

  it('requires an active investing location for a location-scoped plan', () => {
    const scopedPlan = {
      ...aggregatePlan,
      scope: { type: 'location', locationId: investingLocation.id },
    };
    const workspace = validWorkspace();
    workspace.portfolio.plans = [scopedPlan];

    expect(parseWorkspaceDocument(workspace)).not.toBeNull();
    expect(parseWorkspaceDocument({ ...workspace, locations: [] })).toBeNull();
    expect(parseWorkspaceDocument({
      ...workspace,
      locations: [{ ...investingLocation, roles: ['saving'] }],
    })).toBeNull();
    expect(parseWorkspaceDocument({
      ...workspace,
      locations: [{ ...investingLocation, archivedAt: 30 }],
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

  it.each(['income', 'spending', 'saving', 'investing'])
    ('enforces the active %s location capacity', (role) => {
      const workspace = validWorkspace();
      workspace.portfolio.plans = [];
      workspace.locations = Array.from({ length: 11 }, (_, index) => location(index, [role]));

      expect(parseWorkspaceDocument(workspace)).toBeNull();
    });

  it.each(['income', 'spending', 'saving', 'investing'])
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
    const instrument = {
      id: 'card-1',
      shortName: '생활비',
      type: 'credit',
      fundingLocationId: investingLocation.id,
      createdAt: 100,
      updatedAt: 200,
    };
    const flow = {
      id: 'flow-1',
      source: { type: 'location', id: investingLocation.id },
      target: { type: 'instrument', id: instrument.id },
      purpose: 'spending',
      monthlyAmountWon: 500_000,
      createdAt: 100,
      updatedAt: 200,
    };

    expect(parseConsumerInstrument(instrument)).toEqual(instrument);
    expect(parseMonthlyFlow(flow)).toEqual(flow);
    expect(parseMonthlyFlow(flow)?.source).not.toBe(flow.source);
    expect(parseMonthlyFlow(flow)?.target).not.toBe(flow.target);
    expect(parseConsumerInstrument({ ...instrument, extra: true })).toBeNull();
    expect(parseMonthlyFlow({ ...flow, extra: true })).toBeNull();
  });

  it('rejects Account Map references that do not resolve in the workspace', () => {
    const workspace = validWorkspace();
    workspace.accountMap.instruments = [{
      id: 'card-1',
      shortName: '생활비',
      type: 'credit',
      fundingLocationId: 'missing-location',
      createdAt: 100,
      updatedAt: 200,
    }];
    workspace.accountMap.flows = [{
      id: 'flow-1',
      source: { type: 'location', id: investingLocation.id },
      target: { type: 'instrument', id: 'missing-instrument' },
      purpose: 'spending',
      monthlyAmountWon: 500_000,
      createdAt: 100,
      updatedAt: 200,
    }];

    expect(parseWorkspaceDocument(workspace)).toBeNull();
  });

  it('rejects persisted Account Map instruments and flows in Phase A even when references resolve', () => {
    const workspace = validWorkspace();
    const instrument = {
      id: 'card-1',
      shortName: '생활비',
      type: 'credit',
      fundingLocationId: investingLocation.id,
      createdAt: 100,
      updatedAt: 200,
    };
    workspace.accountMap.instruments = [instrument];
    workspace.accountMap.flows = [{
      id: 'flow-1',
      source: { type: 'location', id: investingLocation.id },
      target: { type: 'instrument', id: instrument.id },
      purpose: 'spending',
      monthlyAmountWon: 500_000,
      createdAt: 100,
      updatedAt: 200,
    }];

    expect(parseWorkspaceDocument(workspace)).toBeNull();
  });
});
