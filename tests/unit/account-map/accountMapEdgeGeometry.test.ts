import { describe, expect, it } from 'vitest';
import type { PositionedNode } from '../../../src/account-map/ui/accountMapLayout';
import { buildAccountMapEdgeGeometry } from '../../../src/account-map/ui/accountMapEdgeGeometry';

const purpose: PositionedNode = {
  id: 'system:living', kind: 'purpose', label: '생활비', amountWon: 700_000,
  connectionCount: 1, status: 'resolved', x: 600, y: 100, width: 200, height: 78,
};
const location: PositionedNode = {
  id: 'location:checking', kind: 'location', label: '생활비통장', amountWon: 700_000,
  connectionCount: 1, status: 'resolved', x: 100, y: 300, width: 200, height: 78,
};

describe('Account Map edge geometry', () => {
  it('keeps the existing centered cubic path and midpoint amount anchor', () => {
    expect(buildAccountMapEdgeGeometry(purpose, location)).toEqual({
      path: 'M 700 139 C 450 139, 450 339, 200 339',
      amountAnchor: { left: 450, top: 239 },
    });
  });
});
