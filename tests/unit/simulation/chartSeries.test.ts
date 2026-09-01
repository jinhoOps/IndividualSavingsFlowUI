import { describe, expect, it } from 'vitest';
import type { ProjectionPoint } from '../../../src/simulation/domain/model';
import { buildChartSeries } from '../../../src/simulation/ui/chartSeries';

const projectionPoint: ProjectionPoint = {
  year: 7,
  month: 84,
  contributedPrincipalWon: 41_000_000,
  contributedPrincipalRealWon: 32_000_000,
  savingsNominalWon: 24_000_000,
  savingsRealWon: 19_000_000,
  investmentNominalWon: 37_000_000,
  investmentRealWon: 29_000_000,
  currentPlanNominalWon: 61_000_000,
  allSavingsNominalWon: 53_000_000,
  currentPlanRealWon: 48_000_000,
  allSavingsRealWon: 42_000_000,
};

describe('buildChartSeries', () => {
  it('selects every displayed nominal value from one canonical point', () => {
    const [point] = buildChartSeries([projectionPoint], 'nominal');

    expect(point).toMatchObject({
      month: 84,
      currentPlanWon: 61_000_000,
      allSavingsWon: 53_000_000,
      principalWon: 41_000_000,
      savingsWon: 24_000_000,
      investmentWon: 37_000_000,
      source: projectionPoint,
    });
  });

  it('selects every displayed real value from one canonical point', () => {
    const [point] = buildChartSeries([projectionPoint], 'real');

    expect(point).toMatchObject({
      month: 84,
      currentPlanWon: 48_000_000,
      allSavingsWon: 42_000_000,
      principalWon: 32_000_000,
      savingsWon: 19_000_000,
      investmentWon: 29_000_000,
      source: projectionPoint,
    });
  });

  it('returns no display points for an empty projection', () => {
    expect(buildChartSeries([], 'nominal')).toEqual([]);
  });
});
