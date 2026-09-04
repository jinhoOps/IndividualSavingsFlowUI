import { describe, expect, it } from 'vitest';
import { buildAccountFlowGraph, type AccountFlowGraph } from '../../../src/account-map/ui/accountFlowGraph';
import { layoutAccountFlow } from '../../../src/account-map/ui/accountFlowLayout';
import { salaryLivingBrokerageFixture } from './accountFlowTestSupport';

describe('layoutAccountFlow', () => {
  it('uses left-to-right topological ranks at desktop and top-to-bottom ranks at supported mobile widths', () => {
    const { calculation, applied, locations, main } = salaryLivingBrokerageFixture();
    const graph = buildAccountFlowGraph(calculation, applied, locations, main);

    const desktop = layoutAccountFlow(graph, { width: 1280, height: 900 }, 'default');
    const mobile = layoutAccountFlow(graph, { width: 390, height: 844 }, 'default');
    const tablet = layoutAccountFlow(graph, { width: 768, height: 1024 }, 'default');

    expect(desktop.direction).toBe('left-to-right');
    expect(node(desktop, 'income:external').x).toBeLessThan(node(desktop, 'account:salary').x);
    expect(node(desktop, 'account:salary').x).toBeLessThan(node(desktop, 'account:living').x);
    expect(node(desktop, 'account:living').x).toBeLessThan(node(desktop, 'account:brokerage').x);
    expect(mobile.direction).toBe('top-to-bottom');
    expect(node(mobile, 'income:external').y).toBeLessThan(node(mobile, 'account:salary').y);
    expect(node(mobile, 'account:salary').y).toBeLessThan(node(mobile, 'account:living').y);
    expect(tablet.direction).toBe('top-to-bottom');
    expect(nodesDoNotOverlap(desktop.nodes)).toBe(true);
    expect(nodesDoNotOverlap(mobile.nodes)).toBe(true);
    expect(nodesDoNotOverlap(tablet.nodes)).toBe(true);
  });

  it('is byte-equivalent after reversing source arrays and keeps geometry independent of amounts', () => {
    const fixture = salaryLivingBrokerageFixture();
    const normal = buildAccountFlowGraph(fixture.calculation, fixture.applied, fixture.locations, fixture.main);
    const reversedFixture = salaryLivingBrokerageFixture({ transfers: [...fixture.applied.transfers].reverse() });
    const reversed = buildAccountFlowGraph(
      reversedFixture.calculation,
      { ...reversedFixture.applied, links: [...reversedFixture.applied.links].reverse() },
      [...reversedFixture.locations].reverse(),
      reversedFixture.main,
    );
    const bigger = {
      ...normal,
      edges: normal.edges.map((edge) => edge.kind === 'fixed' ? { ...edge, amountWon: 9_000_000 } : edge),
    };

    const first = layoutAccountFlow(normal, { width: 1280, height: 900 }, 'default');
    const second = layoutAccountFlow(reversed, { width: 1280, height: 900 }, 'default');
    const amountChanged = layoutAccountFlow(bigger, { width: 1280, height: 900 }, 'default');

    expect(second).toEqual(first);
    expect(amountChanged.nodes.map(({ id, width, height }) => ({ id, width, height }))).toEqual(
      first.nodes.map(({ id, width, height }) => ({ id, width, height })),
    );
    expect(amountChanged.edges.filter(({ kind }) => kind === 'fixed').map(({ strokeWidth }) => strokeWidth)).toEqual(
      first.edges.filter(({ kind }) => kind === 'fixed').map(({ strokeWidth }) => strokeWidth),
    );
    expect(first.focusOrder.slice(0, 4)).toEqual([
      'income:external', 'account:salary', 'account:living', 'account:brokerage',
    ]);
  });

  it('fits a dense desktop transfer topology inside the default viewport without changing its node sizes by amount', () => {
    const graph = denseTransferGraph(28);

    const layout = layoutAccountFlow(graph, { width: 1280, height: 900 }, 'default');

    expect(layout.width).toBe(1280);
    expect(layout.isSemanticallyCompacted).toBe(true);
    expect(layout.nodes.every((item) => item.x >= 0 && item.x + item.width <= 1280)).toBe(true);
    expect(new Set(layout.nodes.map(({ width }) => width))).toHaveLength(1);
    expect(nodesDoNotOverlap(layout.nodes)).toBe(true);
  });
});

function node(layout: ReturnType<typeof layoutAccountFlow>, id: string) {
  const result = layout.nodes.find((candidate) => candidate.id === id);
  if (result === undefined) throw new Error(`missing ${id}`);
  return result;
}

function nodesDoNotOverlap(nodes: readonly { x: number; y: number; width: number; height: number }[]) {
  return nodes.every((item, index) => nodes.slice(index + 1).every((candidate) => (
    item.x + item.width <= candidate.x || candidate.x + candidate.width <= item.x
    || item.y + item.height <= candidate.y || candidate.y + candidate.height <= item.y
  )));
}

function denseTransferGraph(count: number): AccountFlowGraph {
  const locations = Array.from({ length: count }, (_, index) => ({
    id: `account:${index}` as `account:${string}`,
    kind: 'account' as const,
    locationId: String(index),
    label: `계좌 ${index}`,
    status: 'planned' as const,
  }));
  return {
    nodes: [{ id: 'income:external', kind: 'external-income', label: '외부 수입', status: 'planned' }, ...locations],
    edges: [
      { id: 'income:0', kind: 'external-income', sourceId: 'income:external', targetId: 'account:0', amountWon: 1, status: 'active', linkId: '0' },
      ...locations.slice(1).map((location, index) => ({
        id: `transfer:${index}` as `transfer:${string}`,
        kind: 'fixed' as const,
        sourceId: `account:${index}` as `account:${string}`,
        targetId: location.id,
        amountWon: 1,
        status: 'active' as const,
        transferId: String(index),
        ruleLabel: '고정 금액' as const,
      })),
    ],
    topologicalOrder: locations.map(({ locationId }) => locationId),
  };
}
