import { describe, expect, it } from 'vitest';
import type { ProjectionPoint } from '../../../src/simulation/domain/model';
import { buildChartGeometry } from '../../../src/simulation/ui/chartGeometry';

const points: ProjectionPoint[] = [
  {
    year: 0, month: 0, contributedPrincipalWon: 0,
    contributedPrincipalRealWon: 0, savingsNominalWon: 0, savingsRealWon: 0,
    investmentNominalWon: 0, investmentRealWon: 0,
    currentPlanNominalWon: 0, allSavingsNominalWon: 0,
    currentPlanRealWon: 0, allSavingsRealWon: 0,
  },
  {
    year: 10, month: 120, contributedPrincipalWon: 60_000_000,
    contributedPrincipalRealWon: 48_000_000,
    savingsNominalWon: 40_000_000, savingsRealWon: 31_000_000,
    investmentNominalWon: 50_000_000, investmentRealWon: 39_000_000,
    currentPlanNominalWon: 90_000_000, allSavingsNominalWon: 70_000_000,
    currentPlanRealWon: 70_000_000, allSavingsRealWon: 55_000_000,
  },
];

describe('buildChartGeometry', () => {
  it('maps both series into one finite shared plot', () => {
    const geometry = buildChartGeometry(points, 'nominal', { width: 680, height: 285 });

    expect(geometry.currentPlanPath).toMatch(/^M/);
    expect(geometry.allSavingsPath).toMatch(/^M/);
    expect(geometry.currentPlanPath).not.toContain('NaN');
    for (const point of geometry.points) {
      expect(point.x).toBeGreaterThanOrEqual(geometry.plot.left);
      expect(point.x).toBeLessThanOrEqual(geometry.plot.right);
      expect(point.currentY).toBeGreaterThanOrEqual(geometry.plot.top);
      expect(point.currentY).toBeLessThanOrEqual(geometry.plot.bottom);
    }
  });
});
