import { describe, expect, it } from 'vitest';
import {
  buildAccountMapCanvasModel,
  buildAccountMapModalRelations,
  withDisplayedPercents,
} from '../../../src/account-map/ui/accountMapCanvasModel';
import type { MapInteractionState } from '../../../src/account-map/application/reducer';
import type { AccountMapApplied } from '../../../src/account-map/domain/model';
import type { PositionedGraph, PositionedNode } from '../../../src/account-map/ui/mapLayout';

describe('buildAccountMapCanvasModel', () => {
  it('orders accessible rows by positioned location then purpose and excludes unrelated nodes from focus', () => {
    const model = buildAccountMapCanvasModel(graph, interaction({ transientNodeId: 'location:salary' }));

    expect(model.canonicalRows.map(({ id }) => id)).toEqual(['income-salary', 'living-salary', 'living-suspended', 'living-checking']);
    expect(model.connectedIds).toEqual(new Set(['location:salary', 'system:income', 'system:living']));
    expect(model.connectedIds.has('location:checking')).toBe(false);
    expect(model.focusedNode?.id).toBe('location:salary');
  });

  it('keeps a pin only when the pinned node is a location', () => {
    expect(buildAccountMapCanvasModel(graph, interaction({ pinnedNodeId: 'location:salary' })).pinnedLocationId).toBe('location:salary');
    expect(buildAccountMapCanvasModel(graph, interaction({ pinnedNodeId: 'system:living' })).pinnedLocationId).toBeNull();
  });
});

describe('buildAccountMapModalRelations', () => {
  it('preserves direct suspended/remainder fields and replacement candidates for a location modal', () => {
    expect(buildAccountMapModalRelations(graph, applied, 'location:salary')).toEqual([
      {
        label: '생활비', amountWon: 400_000, status: 'active', suspendedReason: undefined, linkId: 'living-salary', purposeId: 'system:living',
        purposeTargetWon: 1_000_000, locationId: 'salary', remainder: true,
      },
      {
        label: '수입', amountWon: 2_000_000, status: 'active', suspendedReason: undefined, linkId: 'income-salary', purposeId: 'system:income',
        purposeTargetWon: 2_000_000, locationId: 'salary', remainder: true,
      },
      {
        label: '생활비', amountWon: 100_000, status: 'suspended', suspendedReason: 'user', linkId: 'living-suspended', purposeId: 'system:living',
        purposeTargetWon: 1_000_000, locationId: 'salary', remainder: false,
      },
      {
        label: '생활비통장', amountWon: 600_000, status: 'active', linkId: 'living-checking', purposeId: 'system:living',
        purposeTargetWon: 1_000_000, locationId: 'checking', remainder: false, replacementCandidate: true,
      },
    ]);
  });
});

describe('withDisplayedPercents', () => {
  it('allocates remaining points by largest remainder in existing order', () => {
    expect(withDisplayedPercents([
      { id: 'a', percent: 33.4 },
      { id: 'b', percent: 33.3 },
      { id: 'c', percent: 33.3 },
    ]).map(({ displayPercent }) => displayPercent)).toEqual([34, 33, 33]);
  });

  it('keeps empty rows empty and makes a singleton one hundred percent', () => {
    expect(withDisplayedPercents([])).toEqual([]);
    expect(withDisplayedPercents([{ id: 'only', percent: 87 }])).toEqual([{ id: 'only', percent: 87, displayPercent: 100 }]);
  });
});

function interaction(overrides: Partial<MapInteractionState>): MapInteractionState {
  return { transientNodeId: null, pinnedNodeId: null, modalNodeId: null, ...overrides };
}

const graph: PositionedGraph = {
  direction: 'left-to-right', width: 900, height: 600,
  nodes: [
    node('location:salary', 'location', '급여통장', 0),
    node('location:checking', 'location', '생활비통장', 1),
    node('system:income', 'purpose', '수입', 2, 2_000_000),
    node('system:living', 'purpose', '생활비', 3, 1_000_000),
    node('custom:trip', 'purpose', '여행', 4, 500_000),
  ],
  edges: [
    { id: 'living-checking', purposeId: 'system:living', locationId: 'location:checking', amountWon: 600_000, status: 'active' },
    { id: 'living-salary', purposeId: 'system:living', locationId: 'location:salary', amountWon: 400_000, status: 'active' },
    { id: 'income-salary', purposeId: 'system:income', locationId: 'location:salary', amountWon: 2_000_000, status: 'active' },
    { id: 'living-suspended', purposeId: 'system:living', locationId: 'location:salary', amountWon: 100_000, status: 'suspended' },
  ],
};

function node(
  id: string,
  kind: PositionedNode['kind'],
  label: string,
  order: number,
  allocationTargetWon?: number,
): PositionedNode {
  return {
    id, kind, label, connectionCount: 0, status: 'resolved', x: order * 10, y: 0, width: 120, height: 44,
    ...(allocationTargetWon === undefined ? {} : { allocationTargetWon }),
  };
}

const applied: AccountMapApplied = {
  schemaVersion: 1, sourceMainUpdatedAt: 1, customPurposes: [], layout: 'account', setupCompletedAt: 1, updatedAt: 1,
  links: [
    { id: 'income-salary', purposeId: 'system:income', locationId: 'salary', monthlyAmountWon: 2_000_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 },
    { id: 'living-salary', purposeId: 'system:living', locationId: 'salary', monthlyAmountWon: 400_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 },
    { id: 'living-suspended', purposeId: 'system:living', locationId: 'salary', monthlyAmountWon: 100_000, remainder: false, status: 'suspended', suspendedReason: 'user', createdAt: 1, updatedAt: 1 },
    { id: 'living-checking', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 600_000, remainder: false, status: 'active', createdAt: 1, updatedAt: 1 },
  ],
};
