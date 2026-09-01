import { describe, expect, it } from 'vitest';
import type { CashflowBarAllocation } from '../../../src/main/ui/setup/cashflowBarModel';
import {
  allocationCenter,
  hasIndependentTarget,
  isSegmentClipped,
  pointerPercentage,
  visibleSegmentPercentage,
} from '../../../src/main/ui/setup/cashflowBarInteraction';

const investmentAllocation: CashflowBarAllocation = {
  id: 'investment',
  label: '투자',
  amountWon: 1,
  percentage: 30,
  startPercent: 90,
  widthPercent: 30,
};

describe('cashflow bar interaction helpers', () => {
  it('clamps pointer positions and routes clipped or sub-44px segments to fallback targets', () => {
    expect(pointerPercentage(50, { left: 100, width: 200 })).toBe(0);
    expect(pointerPercentage(400, { left: 100, width: 200 })).toBe(100);
    expect(hasIndependentTarget(4, 680)).toBe(false);
    expect(hasIndependentTarget(8, 680)).toBe(true);
    expect(isSegmentClipped(investmentAllocation, 110)).toBe(true);
  });

  it('uses allocation geometry for tooltip centers and visible segment widths', () => {
    expect(allocationCenter(investmentAllocation)).toBe(100);
    expect(visibleSegmentPercentage(investmentAllocation, 100)).toBe(10);
    expect(visibleSegmentPercentage(investmentAllocation, 80)).toBe(0);
    expect(isSegmentClipped(investmentAllocation, 120)).toBe(false);
  });

  it('treats exactly 44 pixels as an independent target and guards zero-width bars', () => {
    expect(hasIndependentTarget(44 / 680 * 100, 680)).toBe(true);
    expect(hasIndependentTarget(4, 0)).toBe(false);
    expect(pointerPercentage(400, { left: 100, width: 0 })).toBe(0);
  });
});
