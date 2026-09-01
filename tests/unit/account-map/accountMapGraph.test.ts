import { describe, expect, it } from 'vitest';
import type { AccountMapApplied } from '../../../src/account-map/domain/model';
import { buildAccountMapGraphSource, projectAccountMapGraph } from '../../../src/account-map/ui/accountMapGraph';

const main = {
  schemaVersion: 2 as const,
  updatedAt: 1,
  monthlyNetIncomeWon: 2_000_000,
  monthlyHousingWon: 500_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

describe('Account Map graph source', () => {
  it('calculates primary income before overview filtering and retains all active income edges in the source', () => {
    const applied = emptyApplied();
    applied.links = [
      activeLink('income-smaller', 'system:income', 'salary-low', 900_000),
      activeLink('income-larger', 'system:income', 'salary-high', 1_100_000),
    ];
    const locations = [location('salary-low', '보조 급여 통장'), location('salary-high', '주 급여 통장')];

    const source = buildAccountMapGraphSource(applied, locations, main);

    expect(source.primaryIncomeLocationId).toBe('salary-high');
    expect(source.edges.filter(({ purposeId }) => purposeId === 'system:income')).toHaveLength(2);
    expect(projectAccountMapGraph(source, 'overview').edges).toEqual([
      expect.objectContaining({ id: 'income-larger', locationId: 'location:salary-high' }),
    ]);
  });

  it('breaks equal income weights by normalized short name and then location ID', () => {
    const applied = emptyApplied();
    applied.links = [
      activeLink('income-zeta', 'system:income', 'zeta', 1_000_000),
      activeLink('income-alpha-beta', 'system:income', 'beta', 1_000_000),
      activeLink('income-alpha-alpha', 'system:income', 'alpha', 1_000_000),
    ];

    const source = buildAccountMapGraphSource(applied, [
      location('zeta', '  Zeta  '), location('beta', 'alpha'), location('alpha', ' Alpha '),
    ], main);

    expect(source.primaryIncomeLocationId).toBe('alpha');
    expect(projectAccountMapGraph(source, 'default').nodes.filter(({ kind }) => kind === 'location').map(({ id }) => id)).toEqual([
      'location:alpha', 'location:beta', 'location:zeta',
    ]);
  });

  it('keeps income as a normal purpose when no active income location exists', () => {
    const applied = emptyApplied();
    applied.links = [{
      ...activeLink('inactive-income', 'system:income', 'archived-income', 2_000_000),
      remainder: false,
      status: 'suspended',
      suspendedReason: 'user',
    }];

    const source = buildAccountMapGraphSource(applied, [location('archived-income', '이전 수입 통장')], main);
    const overview = projectAccountMapGraph(source, 'overview');

    expect(source.primaryIncomeLocationId).toBeNull();
    expect(overview.nodes.find(({ id }) => id === 'system:income')).toMatchObject({ kind: 'purpose' });
    expect(overview.nodes.find(({ id }) => id === 'system:income')).not.toHaveProperty('isPrimaryIncome');
  });

  it.each([
    ['missing', activeLink('missing-income', 'system:income', 'missing-income', 2_000_000), []],
    ['archived', activeLink('archived-income', 'system:income', 'archived-income', 2_000_000), [
      { ...location('archived-income', '이전 수입 통장'), archivedAt: 2 },
    ]],
    ['zero-value', activeLink('zero-income', 'system:income', 'zero-income', 0), [
      location('zero-income', '0원 수입 통장'),
    ]],
  ] as const)('keeps income unanchored for a %s candidate', (_candidate, incomeLink, locations) => {
    const applied = emptyApplied();
    applied.links = [incomeLink];

    const source = buildAccountMapGraphSource(applied, locations, main);
    const overview = projectAccountMapGraph(source, 'overview');

    expect(source.primaryIncomeLocationId).toBeNull();
    expect(overview.nodes.find(({ id }) => id === 'system:income')).toMatchObject({ kind: 'purpose' });
    expect(overview.nodes.some(({ isPrimaryIncome }) => isPrimaryIncome)).toBe(false);
  });

  it('shows only representative locations with matching edges in overview', () => {
    const applied = emptyApplied();
    applied.links = [
      activeLink('living-primary', 'system:living', 'checking', 700_000, true),
      activeLink('living-backup', 'system:living', 'backup', 300_000),
    ];

    const overview = projectAccountMapGraph(buildAccountMapGraphSource(applied, [
      location('checking', '생활비통장'), location('backup', '보조생활비'), location('vault', '비상금함', 'cash', 'saving'),
    ], main), 'overview');

    expect(overview.edges).toEqual([expect.objectContaining({ id: 'living-primary', locationId: 'location:checking' })]);
    expect(overview.nodes.filter(({ kind }) => kind === 'location')).toEqual([
      expect.objectContaining({ id: 'location:checking', amountWon: 700_000, connectionCount: 1, status: 'resolved' }),
    ]);
    expect(overview.nodes.find(({ id }) => id === 'system:living')).toMatchObject({
      connectionCount: 2, secondary: '대표 계좌 · 외 1개',
    });
  });

  it('keeps every active linked and unlinked location in default and suspended links in detail', () => {
    const applied = emptyApplied();
    applied.links = [
      activeLink('living-primary', 'system:living', 'checking', 700_000, true),
      activeLink('living-backup', 'system:living', 'backup', 300_000),
      { ...activeLink('income-suspended', 'system:income', 'archived-income', 2_000_000), remainder: false, status: 'suspended', suspendedReason: 'user' },
    ];
    const registry = [
      location('checking', '생활비통장'), location('backup', '보조생활비'), location('vault', '비상금함', 'cash', 'saving'), location('archived-income', '이전 수입 통장'),
    ];
    const source = buildAccountMapGraphSource(applied, registry, main);

    const defaultGraph = projectAccountMapGraph(source, 'default');
    const detailGraph = projectAccountMapGraph(source, 'detail');

    expect(defaultGraph.edges.map(({ id }) => id)).toEqual(['living-primary', 'living-backup']);
    expect(detailGraph.edges.map(({ id }) => id)).toEqual(['living-primary', 'living-backup', 'income-suspended']);
    expect(defaultGraph.nodes.filter(({ kind }) => kind === 'location')).toEqual([
      expect.objectContaining({ id: 'location:checking', amountWon: 700_000, connectionCount: 1 }),
      expect.objectContaining({ id: 'location:backup', amountWon: 300_000, connectionCount: 1 }),
      expect.objectContaining({ id: 'location:vault', amountWon: 0, connectionCount: 0 }),
      expect.objectContaining({ id: 'location:archived-income', amountWon: 0, connectionCount: 0 }),
    ]);
    expect(detailGraph.nodes.find(({ id }) => id === 'location:archived-income')).toMatchObject({ status: 'resolved' });
  });

  it('keeps every active registry location discoverable even when it has no links', () => {
    const source = buildAccountMapGraphSource(emptyApplied(), [location('vault', '비상금함', 'cash', 'saving')], main);

    expect(projectAccountMapGraph(source, 'default').nodes.find(({ id }) => id === 'location:vault')).toMatchObject({
      kind: 'location', label: '비상금함', amountWon: 0, connectionCount: 0, status: 'resolved',
    });
  });

  it('shows a system purpose Main reference while retaining its direct allocation target', () => {
    const applied = emptyApplied();
    applied.customPurposes = [{
      id: 'custom:trip', parentId: 'system:living', name: '여행', targetMonthlyWon: 100_000,
      createdAt: 1, updatedAt: 1,
    }];
    applied.links = [activeLink('living', 'system:living', 'checking', 900_000, true)];

    const graph = projectAccountMapGraph(buildAccountMapGraphSource(applied, [location('checking', '생활비통장')], main), 'default');

    expect(graph.nodes.find(({ id }) => id === 'system:living')).toMatchObject({
      amountWon: 1_000_000,
      allocationTargetWon: 900_000,
      status: 'resolved',
    });
    expect(graph.nodes.find(({ id }) => id === 'custom:trip')).toMatchObject({
      amountWon: 100_000,
      allocationTargetWon: 100_000,
    });
  });
});

function activeLink(
  id: string,
  purposeId: 'system:income' | 'system:living',
  locationId: string,
  monthlyAmountWon: number,
  remainder = false,
) {
  return { id, purposeId, locationId, monthlyAmountWon, remainder, status: 'active' as const, createdAt: 1, updatedAt: 1 };
}

function location(
  id: string,
  shortName: string,
  kind: 'bank' | 'cash' = 'bank',
  role: 'saving' | 'spending' = 'saving',
) {
  return { id, shortName, kind, roles: [role], createdAt: 1, updatedAt: 1 };
}

function emptyApplied(): AccountMapApplied {
  return {
    schemaVersion: 1,
    sourceMainUpdatedAt: 1,
    customPurposes: [],
    links: [],
    layout: 'purpose',
    setupCompletedAt: 1,
    updatedAt: 1,
  };
}
