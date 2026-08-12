import { calculateCashflow, percentageOfIncome } from '../../domain/cashflow';
import type { MainData } from '../../domain/model';

export interface CashflowBarSegment {
  id: 'consumption' | 'saving' | 'investment' | 'remaining';
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
  data: MainData,
  viewport: CashflowViewport,
): CashflowBarGeometry {
  const cashflow = calculateCashflow(data);
  if (
    cashflow.incomeWon <= 0
    || !Number.isFinite(cashflow.incomeWon)
    || !Number.isFinite(viewport.barWidthPx)
    || !Number.isFinite(viewport.availableRightPx)
  ) {
    return EMPTY_GEOMETRY;
  }

  let startPercent = 0;
  const segment = (
    id: CashflowBarSegment['id'],
    amountWon: number,
  ): CashflowBarSegment => {
    const widthPercent = percentageOfIncome(amountWon, cashflow.incomeWon) ?? 0;
    const result = { id, startPercent, widthPercent };
    startPercent += widthPercent;
    return result;
  };
  const segments = [
    segment('consumption', cashflow.consumptionWon),
    segment('saving', cashflow.savingWon),
    segment('investment', cashflow.investmentWon),
  ];
  if (cashflow.deficitWon === 0) {
    segments.push(segment('remaining', cashflow.remainingWon));
  }

  const overflowPercent = percentageOfIncome(cashflow.deficitWon, cashflow.incomeWon) ?? 0;
  const capacityPercent = viewport.barWidthPx > 0
    ? Math.max(0, viewport.availableRightPx / viewport.barWidthPx * 100)
    : 0;
  const desiredEndPercent = 100 + overflowPercent;
  const visibleEndPercent = Math.min(desiredEndPercent, 100 + capacityPercent);

  return {
    segments,
    overflowPercent,
    desiredEndPercent,
    visibleEndPercent,
    clipped: visibleEndPercent < desiredEndPercent,
  };
}
