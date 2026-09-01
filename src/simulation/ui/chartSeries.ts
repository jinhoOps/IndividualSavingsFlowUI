import type { CompoundSimulationDraft, ProjectionPoint } from '../domain/model';

export interface ChartSeriesPoint {
  month: number;
  currentPlanWon: number;
  allSavingsWon: number;
  principalWon: number;
  savingsWon: number;
  investmentWon: number;
  source: ProjectionPoint;
}

export function buildChartSeries(
  points: readonly ProjectionPoint[],
  amountMode: CompoundSimulationDraft['amountMode'],
): ChartSeriesPoint[] {
  return points.map((source) => ({
    month: source.month,
    currentPlanWon: amountMode === 'real'
      ? source.currentPlanRealWon
      : source.currentPlanNominalWon,
    allSavingsWon: amountMode === 'real'
      ? source.allSavingsRealWon
      : source.allSavingsNominalWon,
    principalWon: amountMode === 'real'
      ? source.contributedPrincipalRealWon
      : source.contributedPrincipalWon,
    savingsWon: amountMode === 'real'
      ? source.savingsRealWon
      : source.savingsNominalWon,
    investmentWon: amountMode === 'real'
      ? source.investmentRealWon
      : source.investmentNominalWon,
    source,
  }));
}
