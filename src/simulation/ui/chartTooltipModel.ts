import type { GrowthChartTooltipValues } from './GrowthChartTooltip';
import { formatProjectionPeriod } from './chartGeometry';
import type { ChartSeriesPoint } from './chartSeries';
import { formatWon } from './format';

export interface ChartTooltipModel {
  periodLabel: string;
  values: GrowthChartTooltipValues;
  status: string;
}

export function buildChartTooltipModel(
  point: ChartSeriesPoint,
  compact: boolean,
): ChartTooltipModel {
  const periodLabel = formatProjectionPeriod(point.month);
  const values = {
    periodLabel,
    currentPlanWon: point.currentPlanWon,
    allSavingsWon: point.allSavingsWon,
    principalWon: point.principalWon,
    savingsWon: point.savingsWon,
    investmentWon: point.investmentWon,
  };
  const currentPlan = formatWon(values.currentPlanWon);
  const principal = formatWon(values.principalWon);
  const status = compact
    ? `${periodLabel}, 현재 계획 총액 ${currentPlan}, 누적 납입원금 ${principal}`
    : `${periodLabel}, 현재 계획 총액 ${currentPlan}, 전부 저축 총액 ${formatWon(values.allSavingsWon)}, 누적 납입원금 ${principal}, 저축 잔액 ${formatWon(values.savingsWon)}, 투자 잔액 ${formatWon(values.investmentWon)}`;

  return { periodLabel, values, status };
}
