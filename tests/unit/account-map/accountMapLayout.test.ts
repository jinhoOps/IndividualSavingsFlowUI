import { describe, expect, it } from 'vitest';
import type { AccountMapGraph, GraphNode } from '../../../src/account-map/ui/accountMapGraph';
import { layoutAccountMap } from '../../../src/account-map/ui/accountMapLayout';

const graph: AccountMapGraph = {
  primaryIncomeLocationId: 'a',
  nodes: [
    { id: 'system:income', kind: 'purpose', label: '수입', amountWon: 2_000_000, connectionCount: 1, status: 'resolved' },
    { id: 'system:living', kind: 'purpose', label: '생활비', amountWon: 1_000_000, connectionCount: 1, status: 'resolved' },
    { id: 'location:a', kind: 'location', label: '급여통장', amountWon: 2_000_000, isPrimaryIncome: true, connectionCount: 1, status: 'resolved' },
    { id: 'location:b', kind: 'location', label: '생활비통장', amountWon: 1_000_000, connectionCount: 1, status: 'resolved' },
  ],
  edges: [
    { id: 'edge:a', purposeId: 'system:income', locationId: 'location:a', amountWon: 2_000_000, status: 'active' },
    { id: 'edge:b', purposeId: 'system:living', locationId: 'location:b', amountWon: 1_000_000, status: 'active' },
  ],
};

describe('Account Map deterministic layout', () => {
  it('anchors the primary income location first at desktop top-left and purposes on the right', () => {
    const positioned = layoutAccountMap(graph, { width: 1280, height: 900 }, 'default');
    const primary = positioned.nodes.find(({ id }) => id === 'location:a');

    expect(primary).toMatchObject({ x: 28, y: 28, width: 210, height: 78 });
    expect(positioned.nodes.filter(({ kind }) => kind === 'location').every(({ x }) => x < 640)).toBe(true);
    expect(positioned.nodes.filter(({ kind }) => kind === 'purpose').every(({ x }) => x > 640)).toBe(true);
  });

  it.each([[390, 844], [768, 1024]] as const)(
    'places the primary income location first and topmost at %ipx without overlap', (width, height) => {
      const positioned = layoutAccountMap(graph, { width, height }, 'default');
      const primary = positioned.nodes.find(({ id }) => id === 'location:a');

      expect(positioned.nodes[0]?.id).toBe('location:a');
      expect(primary?.y).toBe(Math.min(...positioned.nodes.map(({ y }) => y)));
      expect(nodesDoNotOverlap(positioned.nodes)).toBe(true);
    },
  );

  it('keeps the pre-extraction 28px top margin at the 768px direction breakpoint', () => {
    const positioned = layoutAccountMap(graph, { width: 768, height: 1024 }, 'default');
    const primary = positioned.nodes.find(({ id }) => id === 'location:a');

    expect(positioned.direction).toBe('top-to-bottom');
    expect(primary).toMatchObject({ y: 28 });
  });

  it('only reorders amount-ranked ordinary locations while retaining node dimensions and copied edges', () => {
    const weightedNodes: GraphNode[] = [
      ...graph.nodes,
      { id: 'location:c', kind: 'location', label: '예비 통장', amountWon: 300_000, connectionCount: 1, status: 'resolved' },
    ];
    const initial: AccountMapGraph = {
      ...graph,
      nodes: weightedNodes.map((node) => node.id === 'location:b' ? { ...node, amountWon: 700_000 } : node),
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
      expect(after.nodes.find((node) => node.id === id)).toMatchObject({
        width: before.nodes.find((node) => node.id === id)?.width,
        height: before.nodes.find((node) => node.id === id)?.height,
      });
    }
    expect(after.edges).toEqual(before.edges);
    expect(after.edges).not.toBe(changed.edges);
  });

  it('keeps dense mobile placements contained, non-overlapping, and byte-equivalent', () => {
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

    const first = layoutAccountMap(dense, { width: 390, height: 700 }, 'detail');
    const second = layoutAccountMap(dense, { width: 390, height: 700 }, 'detail');

    expect(first).toEqual(second);
    expect(first.nodes.every((node) => node.height >= 44 && node.y + node.height <= first.height)).toBe(true);
    expect(nodesDoNotOverlap(first.nodes)).toBe(true);
    expect(first.height).toBeGreaterThan(700);
  });
});

function nodesDoNotOverlap(nodes: readonly { x: number; y: number; width: number; height: number }[]) {
  return nodes.every((node, index) => nodes.slice(index + 1).every((candidate) => (
    node.x + node.width <= candidate.x || candidate.x + candidate.width <= node.x
    || node.y + node.height <= candidate.y || candidate.y + candidate.height <= node.y
  )));
}
