import type { CashflowBarAllocation } from './cashflowBarModel';

const MIN_INTERACTIVE_SIZE_PX = 44;

export function pointerPercentage(
  clientX: number,
  bounds: Pick<DOMRect, 'left' | 'width'>,
): number {
  if (bounds.width <= 0) {
    return 0;
  }

  return clampPercentage(((clientX - bounds.left) / bounds.width) * 100);
}

export function allocationCenter(allocation: CashflowBarAllocation): number {
  return clampPercentage(allocation.startPercent + allocation.widthPercent / 2);
}

export function visibleSegmentPercentage(
  allocation: CashflowBarAllocation,
  visibleEndPercent: number,
): number {
  const segmentEndPercent = allocation.startPercent + allocation.widthPercent;
  return Math.max(
    0,
    Math.min(segmentEndPercent, visibleEndPercent) - allocation.startPercent,
  );
}

export function hasIndependentTarget(visiblePercent: number, barWidthPx: number): boolean {
  return barWidthPx > 0 && barWidthPx * visiblePercent / 100 >= MIN_INTERACTIVE_SIZE_PX;
}

export function isSegmentClipped(
  allocation: CashflowBarAllocation,
  visibleEndPercent: number,
): boolean {
  return allocation.startPercent + allocation.widthPercent > visibleEndPercent;
}

function clampPercentage(percentage: number): number {
  return Math.min(100, Math.max(0, percentage));
}
