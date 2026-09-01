import { describe, expect, it } from 'vitest';
import type { AccountMapApplied } from '../../../src/account-map/domain/model';
import { buildAccountMapGraph, layoutAccountMap, type AccountMapGraph, type GraphNode } from '../../../src/account-map/ui/mapLayout';

const graph: AccountMapGraph = {
  primaryIncomeLocationId: 'a',
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
  it.each([[390, 'top-to-bottom'], [768, 'top-to-bottom'], [1280, 'left-to-right']] as const)(
    'keeps deterministic nodes inside %ipx', (width, direction) => {
      const viewport = { width, height: 700 };
      const first = layoutAccountMap(graph, viewport, 'default');
      const second = layoutAccountMap(graph, viewport, 'default');
      expect(first).toEqual(second);
      expect(first.direction).toBe(direction);
      expect(first.nodes.every((node) => node.x >= 0 && node.y >= 0
        && node.x + node.width <= width && node.y + node.height <= viewport.height)).toBe(true);
    },
  );

  it('places graph-selected non-first primary income location top-left on desktop', () => {
    const applied = emptyApplied();
    applied.links = [
      activeLink('income-first', 'system:income', 'first-income', 900_000),
      activeLink('income-primary', 'system:income', 'primary-income', 1_100_000),
    ];
    const accountGraph = buildAccountMapGraph(applied, [
      location('first-income', '첫 수입 통장'), location('primary-income', '주 수입 통장'),
    ], main, 'default');
    const positioned = layoutAccountMap(accountGraph, { width: 1280, height: 900 }, 'default');
    const primary = positioned.nodes.find(({ id }) => id === 'location:primary-income');

    expect(positioned.nodes.filter(({ kind }) => kind === 'location').every(({ x }) => x < 640)).toBe(true);
    expect(positioned.nodes.filter(({ kind }) => kind === 'purpose').every(({ x }) => x > 640)).toBe(true);
    expect(primary).toMatchObject({ x: 28, y: 28 });
  });

  it('only reorders ordinary location slots when their amounts change', () => {
    const weightedNodes: GraphNode[] = [
      ...graph.nodes,
      {
        id: 'location:c', kind: 'location', label: '예비 통장', amountWon: 300_000,
        connectionCount: 1, status: 'resolved',
      },
    ];
    const initial: AccountMapGraph = {
      ...graph,
      nodes: weightedNodes.map((node) => node.id === 'location:a'
        ? { ...node, isPrimaryIncome: true }
        : node.id === 'location:b' ? { ...node, amountWon: 700_000 } : node),
    };
    const changed: AccountMapGraph = {
      ...initial,
      nodes: initial.nodes.map((node) => node.id === 'location:b'
        ? { ...node, amountWon: 100_000 }
        : node.id === 'location:c' ? { ...node, amountWon: 900_000 } : node),
    };

    const before = layoutAccountMap(initial, { width: 1280, height: 900 }, 'default');
    const after = layoutAccountMap(changed, { width: 1280, height: 900 }, 'default');

    expect(before.nodes.filter(({ kind }) => kind === 'location').map(({ id }) => id)).toEqual(['location:a', 'location:b', 'location:c']);
    expect(after.nodes.filter(({ kind }) => kind === 'location').map(({ id }) => id)).toEqual(['location:a', 'location:c', 'location:b']);
    for (const id of ['location:b', 'location:c', 'system:income', 'system:living']) {
      expect(after.nodes.find((node) => node.id === id)).toMatchObject(
        expect.objectContaining({
          width: before.nodes.find((node) => node.id === id)?.width,
          height: before.nodes.find((node) => node.id === id)?.height,
        }),
      );
    }
    expect(after.edges).toEqual(before.edges);
  });

  it.each([[390, 844], [768, 1024]] as const)(
    'places the primary location first with locations before purposes and no overlaps at %ipx', (width, height) => {
      const first = layoutAccountMap(graph, { width, height }, 'default');
      const second = layoutAccountMap(graph, { width, height }, 'default');
      const kinds = first.nodes.map(({ kind }) => kind);

      expect(first).toEqual(second);
      expect(first.nodes[0]?.id).toBe('location:a');
      expect(kinds.lastIndexOf('location')).toBeLessThan(kinds.indexOf('purpose'));
      expect(nodesDoNotOverlap(first.nodes)).toBe(true);
    },
  );

  it.each([390, 768])('contains maximum node density without overlap at %ipx', (width) => {
    const dense: AccountMapGraph = {
      primaryIncomeLocationId: null,
      nodes: Array.from({ length: 26 }, (_, index) => ({
        id: `node:${index}`,
        kind: index < 15 ? 'purpose' as const : 'location' as const,
        label: `노드 ${index}`,
        connectionCount: 0,
        status: 'resolved' as const,
      })),
      edges: [],
    };
    const result = layoutAccountMap(dense, { width, height: 700 }, 'detail');
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

function activeLink(id: string, purposeId: 'system:income' | 'system:living', locationId: string, monthlyAmountWon: number) {
  return { id, purposeId, locationId, monthlyAmountWon, remainder: false, status: 'active' as const, createdAt: 1, updatedAt: 1 };
}

function location(id: string, shortName: string) {
  return { id, shortName, kind: 'bank' as const, roles: ['saving' as const], createdAt: 1, updatedAt: 1 };
}

function nodesDoNotOverlap(nodes: readonly { x: number; y: number; width: number; height: number }[]) {
  return nodes.every((node, index) => nodes.slice(index + 1).every((candidate) => (
    node.x + node.width <= candidate.x || candidate.x + candidate.width <= node.x
    || node.y + node.height <= candidate.y || candidate.y + candidate.height <= node.y
  )));
}

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
