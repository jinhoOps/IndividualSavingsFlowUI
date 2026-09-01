import { describe, expect, it } from 'vitest';
import {
  createDonutSegmentGeometry,
  exitingDonutSegment,
  mergeDonutAllocationIds,
} from '../../../src/main/ui/dashboard/cashflowDonutGeometry';

describe('cashflow donut geometry', () => {
  it('clips visible arcs at 100 while retaining canonical order', () => {
    const geometry = createDonutSegmentGeometry([
      { id: 'consumption', label: '소비', amountWon: 60, percentage: 60, displayPercentage: 60 },
      { id: 'saving', label: '저축', amountWon: 30, percentage: 30, displayPercentage: 30 },
      { id: 'investment', label: '투자', amountWon: 25, percentage: 25, displayPercentage: 25 },
    ]);

    expect(geometry).toEqual([
      { id: 'consumption', visiblePercentage: 60, dashoffset: -0 },
      { id: 'saving', visiblePercentage: 30, dashoffset: -60 },
      { id: 'investment', visiblePercentage: 10, dashoffset: -90 },
    ]);
  });

  it('creates an invisible exiting arc after the visible allocation', () => {
    expect(exitingDonutSegment('remaining')).toEqual({
      id: 'remaining',
      visiblePercentage: 0,
      dashoffset: -100,
    });
  });

  it('merges active and exiting IDs in canonical allocation order', () => {
    expect(mergeDonutAllocationIds(
      ['remaining', 'consumption'],
      ['investment', 'saving'],
    )).toEqual(['consumption', 'saving', 'investment', 'remaining']);
  });
});
