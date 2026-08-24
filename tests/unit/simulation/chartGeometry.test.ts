import { describe, expect, it } from 'vitest';
import type { ProjectionPoint } from '../../../src/simulation/domain/model';
import {
  buildChartGeometry,
  formatProjectionPeriod,
  tooltipPlacement,
} from '../../../src/simulation/ui/chartGeometry';

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

const monthlyPoints: ProjectionPoint[] = Array.from({ length: 37 }, (_, month) => ({
  ...points[0],
  year: month / 12,
  month,
  currentPlanNominalWon: month * 1_000,
  allSavingsNominalWon: month * 1_500,
  currentPlanRealWon: month * 800,
  allSavingsRealWon: month * 1_200,
}));

const annualPoints: ProjectionPoint[] = Array.from({ length: 31 }, (_, year) => ({
  ...points[0],
  year,
  month: year * 12,
  currentPlanNominalWon: year * 1_000,
  allSavingsNominalWon: year * 1_500,
  currentPlanRealWon: year * 800,
  allSavingsRealWon: year * 1_200,
}));

describe('buildChartGeometry', () => {
  it('formats chart periods from canonical month coordinates', () => {
    expect(formatProjectionPeriod(0)).toBe('현재');
    expect(formatProjectionPeriod(1)).toBe('1개월');
    expect(formatProjectionPeriod(12)).toBe('1년');
    expect(formatProjectionPeriod(18)).toBe('1년 6개월');
    expect(formatProjectionPeriod(36)).toBe('3년');
  });

  it('uses every monthly point and labels a short horizon without fractional years', () => {
    const geometry = buildChartGeometry(monthlyPoints, 'nominal');

    expect(geometry.points).toHaveLength(37);
    expect(geometry.points[6]?.month).toBe(6);
    expect(geometry.points[18]?.x).toBeCloseTo((geometry.plot.left + geometry.plot.right) / 2);
    expect(geometry.xTicks.map((tick) => tick.label)).toEqual([
      '현재', '6개월', '1년', '1년 6개월', '2년', '2년 6개월', '3년',
    ]);
    expect(geometry.xTicks.map((tick) => tick.label).join(' ')).not.toMatch(/\d+\.\d+년/);
  });

  it('keeps long annual horizons on five-year month ticks', () => {
    const geometry = buildChartGeometry(annualPoints, 'nominal');

    expect(geometry.xTicks.map((tick) => tick.label)).toEqual([
      '현재', '5년', '10년', '15년', '20년', '25년', '30년',
    ]);
  });

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

  it('builds sparse integer ticks and finite zero-year geometry', () => {
    const geometry = buildChartGeometry([points[0]], 'nominal');

    expect(geometry.xTicks.map((tick) => tick.label)).toEqual(['현재']);
    expect(geometry.yTicks.every((tick) => !tick.label.includes('.'))).toBe(true);
    expect(geometry.currentPlanPath).not.toContain('NaN');

    const thirtyYear = buildChartGeometry([
      points[0],
      { ...points[1], year: 30, month: 360 },
    ], 'nominal');
    expect(thirtyYear.xTicks.at(-1)?.label).toBe('30년');
  });

  it('keeps a fixed tooltip inside horizontal and top chart edges', () => {
    expect(tooltipPlacement({
      anchorX: 620, anchorY: 140,
      chartWidth: 680, tooltipWidth: 240, tooltipHeight: 112,
    })).toEqual({ horizontal: 'left', vertical: 'above' });
    expect(tooltipPlacement({
      anchorX: 120, anchorY: 140,
      chartWidth: 680, tooltipWidth: 240, tooltipHeight: 112,
    })).toEqual({ horizontal: 'right', vertical: 'above' });
    expect(tooltipPlacement({
      anchorX: 120, anchorY: 40,
      chartWidth: 680, tooltipWidth: 240, tooltipHeight: 112,
    })).toEqual({ horizontal: 'right', vertical: 'below' });
  });
});
