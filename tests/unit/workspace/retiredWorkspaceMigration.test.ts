import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertRetiredWorkspaceDocument,
} from '../../../src/workspace/infrastructure/retiredWorkspaceMigration';

const main = {
  schemaVersion: 2,
  updatedAt: 100,
  monthlyNetIncomeWon: 3_000_000,
  monthlyHousingWon: 700_000,
  monthlyLivingWon: 900_000,
  monthlySavingWon: 400_000,
  monthlyInvestmentWon: 200_000,
};

const retiredSimulation = {
  schemaVersion: 2,
  source: {
    monthlySavingsWon: 400_000,
    monthlyInvestmentWon: 200_000,
    mainUpdatedAt: 100,
  },
  initialInvestmentWon: 10_000_000,
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
  items: [{
    id: 'asset-index',
    name: '미국 인덱스',
    shareUnits: 800_000,
    order: 0,
    classification: 'growth',
    classificationOrigin: 'automatic',
  }],
  cashShareUnits: 200_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 300,
  updatedAt: 300,
};

const locationPlan = {
  ...aggregatePlan,
  scope: { type: 'location', locationId: 'loc-isa' },
  appliedAt: 301,
  updatedAt: 301,
};

const aggregateDraft = {
  schemaVersion: 2,
  scope: { type: 'aggregate' },
  items: [{
    id: 'asset-index',
    name: '미국 인덱스',
    shareUnits: 800_000,
    order: 0,
    classification: 'growth',
    classificationOrigin: 'automatic',
  }],
  cashShareUnits: 200_000,
  cashMode: 'automatic',
  inputMode: 'amount',
  syncedInvestmentWon: 200_000,
  updatedAt: 302,
  isApplicable: true,
};

const locationDraft = {
  ...aggregateDraft,
  scope: { type: 'location', locationId: 'loc-isa' },
  updatedAt: 303,
};

const locations = [{
  id: 'loc-isa',
  shortName: 'ISA',
  kind: 'brokerage',
  roles: ['investing'],
  createdAt: 10,
  updatedAt: 20,
}];

const customPurpose = {
  id: 'custom:future',
  parentId: 'system:investing',
  name: '미래',
  targetMonthlyWon: 100_000,
  createdAt: 30,
  updatedAt: 30,
};

const purposeLink = {
  id: 'link-future',
  purposeId: 'custom:future',
  locationId: 'loc-isa',
  monthlyAmountWon: 100_000,
  remainder: true,
  status: 'active',
  createdAt: 40,
  updatedAt: 40,
};

function retiredV2() {
  return {
    schemaVersion: 2,
    revision: 4,
    updatedAt: 400,
    main: { applied: { ...main }, setupProgress: null },
    simulation: {
      draft: { ...retiredSimulation, source: { ...retiredSimulation.source } },
    },
    portfolio: {
      plans: [
        { ...aggregatePlan, scope: { ...aggregatePlan.scope }, items: aggregatePlan.items.map((item) => ({ ...item })) },
        { ...locationPlan, scope: { ...locationPlan.scope }, items: locationPlan.items.map((item) => ({ ...item })) },
      ],
      draft: { ...locationDraft, scope: { ...locationDraft.scope }, items: locationDraft.items.map((item) => ({ ...item })) },
    },
    locations: locations.map((location) => ({ ...location, roles: [...location.roles] })),
    accountMap: {
      applied: {
        schemaVersion: 1,
        sourceMainUpdatedAt: 100,
        customPurposes: [{ ...customPurpose }],
        links: [{ ...purposeLink }],
        layout: 'account',
        setupCompletedAt: 350,
        updatedAt: 350,
      },
      draft: {
        schemaVersion: 1,
        sourceMainUpdatedAt: 100,
        customPurposes: [{ ...customPurpose }],
        links: [{ ...purposeLink }],
        step: 'review',
        updatedAt: 351,
      },
      legacyPhaseA: {
        instruments: [{
          id: 'card-1',
          shortName: '생활비 카드',
          type: 'credit',
          fundingLocationId: 'loc-isa',
          createdAt: 25,
          updatedAt: 25,
        }],
        flows: [],
      },
    },
  };
}

function retiredV1() {
  const source = retiredV2();
  return {
    ...source,
    schemaVersion: 1,
    accountMap: {
      applied: null,
      draft: null,
      instruments: source.accountMap.legacyPhaseA.instruments.map((instrument) => ({ ...instrument })),
      flows: [],
    },
  };
}

describe('retired workspace conversion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts exact v2 data field-by-field and drops every retired value', () => {
    const source = retiredV2();
    const original = structuredClone(source);
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);

    const result = convertRetiredWorkspaceDocument(source, 500);

    expect(result).toMatchObject({
      status: 'converted',
      sourceVersion: 2,
      simulationMigration: 'schema-upgraded',
      workspace: {
        schemaVersion: 3,
        revision: 4,
        updatedAt: 500,
        main: source.main,
        simulation: {
          draft: {
            schemaVersion: 3,
            targetAmountWon: 100_000_000,
          },
        },
        portfolio: { plans: [aggregatePlan], draft: null },
        locations,
        accountMap: {
          applied: {
            schemaVersion: 2,
            sourceMainUpdatedAt: 100,
            customPurposes: [customPurpose],
            links: [purposeLink],
            setupCompletedAt: 350,
            updatedAt: 350,
          },
          draft: source.accountMap.draft,
        },
      },
    });
    if (result.status !== 'converted') throw new Error('expected converted result');
    expect(result.workspace.accountMap.applied).not.toHaveProperty('layout');
    expect(result.workspace.accountMap).not.toHaveProperty('legacyPhaseA');
    expect(result.workspace.portfolio.plans).toHaveLength(1);
    expect(source).toEqual(original);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('converts exact v1 data while dropping Phase A and location-scoped Portfolio values', () => {
    const source = retiredV1();
    const result = convertRetiredWorkspaceDocument(source, 500);

    expect(result).toMatchObject({
      status: 'converted',
      sourceVersion: 1,
      simulationMigration: 'schema-upgraded',
      workspace: {
        schemaVersion: 3,
        main: source.main,
        simulation: {
          draft: {
            schemaVersion: 3,
            targetAmountWon: 100_000_000,
          },
        },
        portfolio: { plans: [aggregatePlan], draft: null },
        locations,
        accountMap: { applied: null, draft: null },
      },
    });
  });

  it('preserves an aggregate draft while dropping location-scoped plans', () => {
    const source = retiredV2();
    source.portfolio.draft = structuredClone(aggregateDraft) as typeof source.portfolio.draft;

    const result = convertRetiredWorkspaceDocument(source, 500);

    expect(result).toMatchObject({
      status: 'converted',
      workspace: { portfolio: { plans: [aggregatePlan], draft: aggregateDraft } },
    });
  });

  it.each([
    ['workspace version', (source: ReturnType<typeof retiredV2>) => ({ ...source, schemaVersion: 4 })],
    ['Account Map version', (source: ReturnType<typeof retiredV2>) => ({
      ...source,
      accountMap: {
        ...source.accountMap,
        applied: { ...source.accountMap.applied, schemaVersion: 2 },
      },
    })],
    ['Portfolio version', (source: ReturnType<typeof retiredV2>) => ({
      ...source,
      portfolio: {
        ...source.portfolio,
        plans: [{ ...source.portfolio.plans[0], schemaVersion: 3 }],
      },
    })],
    ['Simulation version', (source: ReturnType<typeof retiredV2>) => ({
      ...source,
      simulation: { draft: { ...source.simulation.draft, schemaVersion: 4 } },
    })],
  ])('rejects an unknown %s', (_label, mutate) => {
    expect(convertRetiredWorkspaceDocument(mutate(retiredV2()), 500))
      .toEqual({ status: 'invalid', reason: 'schema' });
  });

  it.each([
    ['missing retained link location', (source: ReturnType<typeof retiredV2>) => ({
      ...source,
      locations: [],
    })],
    ['duplicate location identifier', (source: ReturnType<typeof retiredV2>) => ({
      ...source,
      locations: [...source.locations, { ...source.locations[0], shortName: 'ISA 2' }],
    })],
    ['duplicate custom-purpose identifier', (source: ReturnType<typeof retiredV2>) => ({
      ...source,
      accountMap: {
        ...source.accountMap,
        applied: {
          ...source.accountMap.applied,
          customPurposes: [customPurpose, customPurpose],
        },
      },
    })],
  ])('rejects an invalid retained reference: %s', (_label, mutate) => {
    expect(convertRetiredWorkspaceDocument(mutate(retiredV2()), 500))
      .toEqual({ status: 'invalid', reason: 'reference' });
  });

  it.each([
    ['workspace updatedAt', (source: ReturnType<typeof retiredV2>) => ({ ...source, updatedAt: 501 })],
    ['nested updatedAt', (source: ReturnType<typeof retiredV2>) => ({
      ...source,
      main: { ...source.main, applied: { ...source.main.applied, updatedAt: 501 } },
    })],
  ])('rejects a future %s', (_label, mutate) => {
    expect(convertRetiredWorkspaceDocument(mutate(retiredV2()), 500))
      .toEqual({ status: 'invalid', reason: 'schema' });
  });

  it('rejects an invalid migration timestamp', () => {
    expect(convertRetiredWorkspaceDocument(retiredV2(), -1))
      .toEqual({ status: 'invalid', reason: 'schema' });
  });
});
