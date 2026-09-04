import { describe, expect, it } from 'vitest';
import { buildAccountFlowGraph } from '../../../src/account-map/ui/accountFlowGraph';
import { salaryLivingBrokerageFixture, transfer } from './accountFlowTestSupport';

describe('buildAccountFlowGraph', () => {
  it('projects one account per location, a single external income anchor, and directed transfer edges', () => {
    const { calculation, applied, locations, main } = salaryLivingBrokerageFixture();

    const graph = buildAccountFlowGraph(calculation, applied, locations, main);

    expect(graph.nodes
      .filter((node): node is Extract<(typeof graph.nodes)[number], { kind: 'account' }> => node.kind === 'account')
      .map(({ locationId }) => locationId)).toEqual([
      'brokerage', 'living', 'salary',
    ]);
    expect(graph.nodes.filter(({ kind }) => kind === 'external-income').map(({ id }) => id)).toEqual([
      'income:external',
    ]);
    expect(graph.edges.filter(({ kind }) => kind === 'fixed' || kind === 'sweep')).toEqual([
      expect.objectContaining({
        id: 'transfer:living-brokerage',
        kind: 'sweep',
        sourceId: 'account:living',
        targetId: 'account:brokerage',
        amountWon: 0,
      }),
      expect.objectContaining({
        id: 'transfer:salary-living',
        kind: 'fixed',
        sourceId: 'account:salary',
        targetId: 'account:living',
        amountWon: 900_000,
      }),
    ]);
    expect(graph.edges).toContainEqual(expect.objectContaining({
      id: 'purpose:living-local',
      kind: 'purpose',
      sourceId: 'account:living',
      targetId: 'purpose:system:living',
    }));
    expect(graph.edges).toContainEqual(expect.objectContaining({
      id: 'income:income-salary',
      kind: 'external-income',
      sourceId: 'income:external',
      targetId: 'account:salary',
    }));
  });

  it('keeps transfer edges distinct from purpose-location connections and exposes planning warnings', () => {
    const { calculation, applied, locations, main } = salaryLivingBrokerageFixture({
      transfers: [transfer('salary-living', 'salary', 'living', { kind: 'fixed', monthlyAmountWon: 500_000 })],
    });

    const graph = buildAccountFlowGraph(calculation, applied, locations, main);

    expect(graph.edges.filter(({ kind }) => kind === 'purpose').map(({ id }) => id)).toEqual([
      'purpose:investing-local', 'purpose:living-local',
    ]);
    expect(graph.edges.filter(({ kind }) => kind === 'warning')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'warning:living:shortfall',
        sourceId: 'account:living',
        targetId: 'warning:living:shortfall',
        amountWon: 400_000,
      }),
      expect.objectContaining({ id: 'warning:salary:unassigned', amountWon: 2_600_000 }),
      expect.objectContaining({ id: 'warning:brokerage:shortfall', amountWon: 1_000_000 }),
    ]));
  });
});
