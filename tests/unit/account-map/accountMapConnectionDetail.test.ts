import { describe, expect, it } from 'vitest';
import { summarizeLocationConnectionDetail } from '../../../src/account-map/ui/accountMapConnectionDetail';
import type { PositionedGraph } from '../../../src/account-map/ui/mapLayout';

describe('summarizeLocationConnectionDetail', () => {
  it('aggregates active links by canonical purpose order before calculating percentages', () => {
    const detail = summarizeLocationConnectionDetail(graph, 'location:salary');

    expect(detail?.totalWon).toBe(660);
    expect(detail?.rows.map(({ purposeId, label, amountWon }) => ({ purposeId, label, amountWon }))).toEqual([
      { purposeId: 'system:income', label: '수입', amountWon: 200 },
      { purposeId: 'system:living', label: '생활비', amountWon: 400 },
      { purposeId: 'custom:travel', label: '여행', amountWon: 60 },
    ]);
    expect(detail?.rows.map(({ percent }) => percent)).toEqual([expect.closeTo(1000 / 33), expect.closeTo(2000 / 33), expect.closeTo(1000 / 110)]);
    expect(detail?.rows.reduce((sum, row) => sum + Math.round(row.percent), 0)).toBe(100);
  });

  it('returns an explicit empty detail for a location without active links', () => {
    expect(summarizeLocationConnectionDetail(graph, 'location:empty')).toEqual({ totalWon: 0, rows: [] });
  });
});

const graph: PositionedGraph = {
  direction: 'left-to-right',
  width: 900,
  height: 600,
  nodes: [
    node('location:salary', 'location', '급여통장'),
    node('location:empty', 'location', '비상금함'),
    node('system:income', 'purpose', '수입', 0),
    node('system:living', 'purpose', '생활비', 2),
    node('custom:travel', 'purpose', '여행', 5),
  ],
  edges: [
    { id: 'income', purposeId: 'system:income', locationId: 'location:salary', amountWon: 200, status: 'active' },
    { id: 'living-first', purposeId: 'system:living', locationId: 'location:salary', amountWon: 110, status: 'active' },
    { id: 'living-second', purposeId: 'system:living', locationId: 'location:salary', amountWon: 290, status: 'active' },
    { id: 'travel-active', purposeId: 'custom:travel', locationId: 'location:salary', amountWon: 60, status: 'active' },
    { id: 'travel-suspended', purposeId: 'custom:travel', locationId: 'location:salary', amountWon: 900, status: 'suspended' },
  ],
};

function node(
  id: string,
  kind: 'purpose' | 'location',
  label: string,
  purposeOrder?: number,
): PositionedGraph['nodes'][number] {
  return {
    id,
    kind,
    label,
    ...(purposeOrder === undefined ? {} : { purposeOrder }),
    connectionCount: 0,
    status: 'resolved',
    x: 0,
    y: 0,
    width: 120,
    height: 44,
  };
}
