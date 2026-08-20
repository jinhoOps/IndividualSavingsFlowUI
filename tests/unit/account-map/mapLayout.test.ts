import { describe, expect, it } from 'vitest';
import type { AccountMapApplied } from '../../../src/account-map/domain/model';
import { buildAccountMapGraph, layoutAccountMap, type AccountMapGraph } from '../../../src/account-map/ui/mapLayout';

const graph: AccountMapGraph = {
  nodes: [
    { id: 'system:income', kind: 'purpose', label: '수입', amountWon: 2_000_000, connectionCount: 1, status: 'resolved' },
    { id: 'system:living', kind: 'purpose', label: '생활비', amountWon: 1_000_000, connectionCount: 1, status: 'resolved' },
    { id: 'location:a', kind: 'location', label: '급여통장', connectionCount: 1, status: 'resolved' },
    { id: 'location:b', kind: 'location', label: '생활비통장', connectionCount: 1, status: 'resolved' },
  ],
  edges: [
    { id: 'edge:a', purposeId: 'system:income', locationId: 'location:a', amountWon: 2_000_000, status: 'active' },
    { id: 'edge:b', purposeId: 'system:living', locationId: 'location:b', amountWon: 1_000_000, status: 'active' },
  ],
};

describe('Account Map layout', () => {
  it('shows only representative locations with matching edges in overview', () => {
    const applied = emptyApplied();
    applied.links = [
      {
        id: 'living-primary', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 700_000,
        remainder: true, status: 'active', createdAt: 1, updatedAt: 1,
      },
      {
        id: 'living-backup', purposeId: 'system:living', locationId: 'backup', monthlyAmountWon: 300_000,
        remainder: false, status: 'active', createdAt: 1, updatedAt: 1,
      },
    ];
    const result = buildAccountMapGraph(applied, [
      { id: 'checking', shortName: '생활비통장', kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 },
      { id: 'backup', shortName: '보조생활비', kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 },
      { id: 'vault', shortName: '비상금함', kind: 'cash', roles: ['saving'], createdAt: 1, updatedAt: 1 },
    ], main, 'overview');

    expect(result.edges).toEqual([expect.objectContaining({ id: 'living-primary', locationId: 'location:checking' })]);
    expect(result.nodes.filter(({ kind }) => kind === 'location')).toEqual([
      expect.objectContaining({
        id: 'location:checking', amountWon: 700_000, connectionCount: 1, status: 'resolved',
      }),
    ]);
    expect(result.nodes.find(({ id }) => id === 'system:living')).toMatchObject({
      connectionCount: 2, secondary: '대표 계좌 · 외 1개',
    });
  });

  it('keeps every active linked and unlinked location in default and detail views', () => {
    const applied = emptyApplied();
    applied.links = [
      {
        id: 'living-primary', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 700_000,
        remainder: true, status: 'active', createdAt: 1, updatedAt: 1,
      },
      {
        id: 'living-backup', purposeId: 'system:living', locationId: 'backup', monthlyAmountWon: 300_000,
        remainder: false, status: 'active', createdAt: 1, updatedAt: 1,
      },
    ];
    const registry = [
      { id: 'checking', shortName: '생활비통장', kind: 'bank' as const, roles: ['spending' as const], createdAt: 1, updatedAt: 1 },
      { id: 'backup', shortName: '보조생활비', kind: 'bank' as const, roles: ['spending' as const], createdAt: 1, updatedAt: 1 },
      { id: 'vault', shortName: '비상금함', kind: 'cash' as const, roles: ['saving' as const], createdAt: 1, updatedAt: 1 },
    ];

    for (const zoom of ['default', 'detail'] as const) {
      const result = buildAccountMapGraph(applied, registry, main, zoom);
      expect(result.edges.map(({ id }) => id)).toEqual(['living-primary', 'living-backup']);
      expect(result.nodes.filter(({ kind }) => kind === 'location')).toEqual([
        expect.objectContaining({ id: 'location:checking', amountWon: 700_000, connectionCount: 1 }),
        expect.objectContaining({ id: 'location:backup', amountWon: 300_000, connectionCount: 1 }),
        expect.objectContaining({ id: 'location:vault', amountWon: 0, connectionCount: 0 }),
      ]);
    }
  });

  it('keeps every active registry location discoverable even when it has no links', () => {
    const result = buildAccountMapGraph(emptyApplied(), [
      { id: 'vault', shortName: '비상금함', kind: 'cash', roles: ['saving'], createdAt: 1, updatedAt: 1 },
    ], main, 'default');

    expect(result.nodes.find(({ id }) => id === 'location:vault')).toMatchObject({
      kind: 'location', label: '비상금함', amountWon: 0, connectionCount: 0, status: 'resolved',
    });
  });

  it('shows a system purpose Main reference while retaining its direct allocation target', () => {
    const applied = emptyApplied();
    applied.customPurposes = [{
      id: 'custom:trip', parentId: 'system:living', name: '여행', targetMonthlyWon: 100_000,
      createdAt: 1, updatedAt: 1,
    }];
    applied.links = [{
      id: 'living', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 900_000,
      remainder: true, status: 'active', createdAt: 1, updatedAt: 1,
    }];
    const result = buildAccountMapGraph(applied, [
      { id: 'checking', shortName: '생활비통장', kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 },
    ], main, 'default');

    expect(result.nodes.find(({ id }) => id === 'system:living')).toMatchObject({
      amountWon: 1_000_000,
      allocationTargetWon: 900_000,
      status: 'resolved',
    });
    expect(result.nodes.find(({ id }) => id === 'custom:trip')).toMatchObject({
      amountWon: 100_000,
      allocationTargetWon: 100_000,
    });
  });

  it.each([[390, 'top-to-bottom'], [768, 'top-to-bottom'], [1280, 'left-to-right']] as const)(
    'keeps deterministic nodes inside %ipx', (width, direction) => {
      const viewport = { width, height: 700 };
      const first = layoutAccountMap(graph, 'purpose', viewport, 'default');
      const second = layoutAccountMap(graph, 'purpose', viewport, 'default');
      expect(first).toEqual(second);
      expect(first.direction).toBe(direction);
      expect(first.nodes.every((node) => node.x >= 0 && node.y >= 0
        && node.x + node.width <= width && node.y + node.height <= viewport.height)).toBe(true);
    },
  );

  it('changes ordering without changing node or edge identity', () => {
    const purpose = layoutAccountMap(graph, 'purpose', { width: 1000, height: 600 }, 'default');
    const account = layoutAccountMap(graph, 'account', { width: 1000, height: 600 }, 'default');
    expect(account.nodes.map(({ id }) => id).sort()).toEqual(purpose.nodes.map(({ id }) => id).sort());
    expect(account.edges.map(({ id }) => id)).toEqual(purpose.edges.map(({ id }) => id));
    expect(account.nodes).not.toEqual(purpose.nodes);
  });

  it.each([390, 768])('contains maximum node density without overlap at %ipx', (width) => {
    const dense: AccountMapGraph = {
      nodes: Array.from({ length: 26 }, (_, index) => ({
        id: `node:${index}`,
        kind: index < 15 ? 'purpose' as const : 'location' as const,
        label: `노드 ${index}`,
        connectionCount: 0,
        status: 'resolved' as const,
      })),
      edges: [],
    };
    const result = layoutAccountMap(dense, 'purpose', { width, height: 700 }, 'detail');
    expect(result.nodes.every((node) => node.height >= 44
      && node.y + node.height <= result.height)).toBe(true);
    for (const [index, node] of result.nodes.entries()) {
      expect(result.nodes.slice(index + 1).every((candidate) => (
        node.x + node.width <= candidate.x || candidate.x + candidate.width <= node.x
        || node.y + node.height <= candidate.y || candidate.y + candidate.height <= node.y
      ))).toBe(true);
    }
    expect(result.height).toBeGreaterThan(700);
  });
});

const main = {
  schemaVersion: 2 as const,
  updatedAt: 1,
  monthlyNetIncomeWon: 2_000_000,
  monthlyHousingWon: 500_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

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
