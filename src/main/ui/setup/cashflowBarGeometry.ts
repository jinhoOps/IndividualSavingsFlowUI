import type { CashflowAllocationId, CashflowBarModel } from './cashflowBarModel';

export interface CashflowBarSegment {
  id: CashflowAllocationId;
  startPercent: number;
  widthPercent: number;
}

export interface CashflowBarGeometry {
  segments: CashflowBarSegment[];
  overflowPercent: number;
  desiredEndPercent: number;
  visibleEndPercent: number;
  clipped: boolean;
}

export interface CashflowViewport {
  barWidthPx: number;
  availableRightPx: number;
}

const EMPTY_GEOMETRY: CashflowBarGeometry = {
  segments: [],
  overflowPercent: 0,
  desiredEndPercent: 0,
  visibleEndPercent: 0,
  clipped: false,
};

export function createCashflowBarGeometry(
  model: CashflowBarModel,
  viewport: CashflowViewport,
): CashflowBarGeometry {
  if (
    model.incomeWon <= 0
    || !Number.isFinite(model.incomeWon)
    || !Number.isFinite(viewport.barWidthPx)
    || !Number.isFinite(viewport.availableRightPx)
  ) {
    return EMPTY_GEOMETRY;
  }

  const overflowPercent = model.incomeWon > 0
    ? model.deficitWon / model.incomeWon * 100
    : 0;
  const capacityPercent = viewport.barWidthPx > 0
    ? Math.max(0, viewport.availableRightPx / viewport.barWidthPx * 100)
    : 0;
  const desiredEndPercent = 100 + overflowPercent;
  const visibleEndPercent = Math.min(desiredEndPercent, 100 + capacityPercent);

  return {
    segments: model.allocations.map(({ id, startPercent, widthPercent }) => ({
      id,
      startPercent,
      widthPercent,
    })),
    overflowPercent,
    desiredEndPercent,
    visibleEndPercent,
    clipped: visibleEndPercent < desiredEndPercent,
  };
}
