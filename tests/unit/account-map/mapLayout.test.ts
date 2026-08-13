import { describe, expect, it } from 'vitest';
import { layoutAccountMap, type AccountMapGraph } from '../../../src/account-map/ui/mapLayout';

const graph: AccountMapGraph = {
  nodes: [
    { id: 'system:income', kind: 'purpose', label: '수입', amountWon: 2_000_000, status: 'resolved' },
    { id: 'system:living', kind: 'purpose', label: '생활비', amountWon: 1_000_000, status: 'resolved' },
    { id: 'location:a', kind: 'location', label: '급여통장', status: 'resolved' },
    { id: 'location:b', kind: 'location', label: '생활비통장', status: 'resolved' },
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

  it('contains the maximum expected mobile node density with 44px targets', () => {
    const dense: AccountMapGraph = {
      nodes: Array.from({ length: 26 }, (_, index) => ({
        id: `node:${index}`,
        kind: index < 15 ? 'purpose' as const : 'location' as const,
        label: `노드 ${index}`,
        status: 'resolved' as const,
      })),
      edges: [],
    };
    const result = layoutAccountMap(dense, 'purpose', { width: 390, height: 700 }, 'detail');
    expect(result.nodes.every((node) => node.height >= 44
      && node.y + node.height <= result.height)).toBe(true);
  });
});
