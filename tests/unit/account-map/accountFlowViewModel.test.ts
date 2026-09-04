import { describe, expect, it } from 'vitest';
import { buildAccountFlowGraph } from '../../../src/account-map/ui/accountFlowGraph';
import { buildAccountFlowViewModel } from '../../../src/account-map/ui/accountFlowViewModel';
import { salaryLivingBrokerageFixture } from './accountFlowTestSupport';

describe('buildAccountFlowViewModel', () => {
  it('pins the selected account’s complete upstream and downstream transfer path while dimming unrelated nodes', () => {
    const { calculation, applied, locations, main } = salaryLivingBrokerageFixture();
    const graph = buildAccountFlowGraph(calculation, applied, [
      ...locations,
      { id: 'cash', shortName: '현금', kind: 'cash' as const, roles: ['spending' as const], createdAt: 1, updatedAt: 1 },
    ], main);

    const view = buildAccountFlowViewModel(graph, { type: 'account', locationId: 'living' });

    expect(view.reachableNodeIds).toEqual(expect.arrayContaining([
      'account:salary', 'account:living', 'account:brokerage', 'purpose:system:living',
      'purpose:system:investing', 'warning:brokerage:shortfall',
    ]));
    expect(view.reachableEdgeIds).toEqual(expect.arrayContaining([
      'income:income-salary', 'purpose:living-local', 'purpose:investing-local',
      'transfer:living-brokerage', 'transfer:salary-living', 'warning:brokerage:shortfall',
    ]));
    expect(view.dimmedNodeIds).toContain('account:cash');
    expect(view.dimmedNodeIds).not.toContain('account:salary');
    expect(view.visibleEdgeAmountIds).toEqual(expect.arrayContaining([
      'transfer:living-brokerage', 'transfer:salary-living', 'purpose:investing-local',
    ]));
    expect(view.detailGroups.map(({ key }) => key)).toEqual(['incoming', 'local-allocations', 'outgoing']);
    expect(view.detailGroups.find(({ key }) => key === 'incoming')?.rows).toEqual([
      expect.objectContaining({ id: 'transfer:salary-living', label: '급여 통장', amountWon: 900_000 }),
    ]);
    expect(view.detailGroups.find(({ key }) => key === 'local-allocations')?.rows).toEqual([
      expect.objectContaining({ id: 'purpose:living-local', label: '생활비', amountWon: 900_000 }),
    ]);
    expect(view.detailGroups.find(({ key }) => key === 'outgoing')?.rows).toEqual([
      expect.objectContaining({ id: 'transfer:living-brokerage', label: '증권 계좌', amountWon: 0 }),
    ]);
  });

  it('creates a deterministic canonical reading table that never turns account flow into one mixed total', () => {
    const { calculation, applied, locations, main } = salaryLivingBrokerageFixture();
    const graph = buildAccountFlowGraph(calculation, applied, [...locations].reverse(), main);

    const view = buildAccountFlowViewModel(graph, null);

    expect(view.tableRows).toEqual([
      expect.objectContaining({ sourceLabel: '외부 수입', targetLabel: '급여 통장', kind: 'external-income', amountWon: 3_100_000 }),
      expect.objectContaining({ sourceLabel: '급여 통장', targetLabel: '생활비 통장', kind: 'fixed', amountWon: 900_000 }),
      expect.objectContaining({ sourceLabel: '생활비 통장', targetLabel: '증권 계좌', kind: 'sweep', amountWon: 0 }),
      expect.objectContaining({ sourceLabel: '생활비 통장', targetLabel: '생활비', kind: 'purpose', amountWon: 900_000 }),
      expect.objectContaining({ sourceLabel: '증권 계좌', targetLabel: '투자', kind: 'purpose', amountWon: 1_000_000 }),
    ]);
    expect(view.tableRows.map(({ sourceLabel, targetLabel }) => [sourceLabel, targetLabel])).toEqual([
      ['외부 수입', '급여 통장'],
      ['급여 통장', '생활비 통장'],
      ['생활비 통장', '증권 계좌'],
      ['생활비 통장', '생활비'],
      ['증권 계좌', '투자'],
    ]);
    expect(view.focusOrder.slice(0, 4)).toEqual([
      'income:external', 'account:salary', 'account:living', 'account:brokerage',
    ]);
  });
});
