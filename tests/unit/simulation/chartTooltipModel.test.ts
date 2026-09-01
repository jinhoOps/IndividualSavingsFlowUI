import { describe, expect, it } from 'vitest';
import type { ProjectionPoint } from '../../../src/simulation/domain/model';
import { buildChartSeries } from '../../../src/simulation/ui/chartSeries';
import { buildChartTooltipModel } from '../../../src/simulation/ui/chartTooltipModel';

const source: ProjectionPoint = {
  year: 0.5,
  month: 6,
  contributedPrincipalWon: 9_000_000,
  contributedPrincipalRealWon: 8_000_000,
  savingsNominalWon: 4_000_000,
  savingsRealWon: 3_500_000,
  investmentNominalWon: 8_000_000,
  investmentRealWon: 7_000_000,
  currentPlanNominalWon: 12_000_000,
  allSavingsNominalWon: 10_000_000,
  currentPlanRealWon: 10_500_000,
  allSavingsRealWon: 9_000_000,
};

const [point] = buildChartSeries([source], 'nominal');

describe('buildChartTooltipModel', () => {
  it('builds compact period, values, and screen-reader status from one display point', () => {
    expect(buildChartTooltipModel(point!, true)).toMatchObject({
      periodLabel: '6개월',
      values: {
        periodLabel: '6개월',
        currentPlanWon: 12_000_000,
        principalWon: 9_000_000,
      },
      status: '6개월, 현재 계획 총액 1,200만 원, 누적 납입원금 900만 원',
    });
  });

  it('keeps every detailed value from the same display point', () => {
    expect(buildChartTooltipModel(point!, false).values).toMatchObject({
      periodLabel: '6개월',
      currentPlanWon: point!.currentPlanWon,
      allSavingsWon: point!.allSavingsWon,
      principalWon: point!.principalWon,
      savingsWon: point!.savingsWon,
      investmentWon: point!.investmentWon,
    });
  });
});
