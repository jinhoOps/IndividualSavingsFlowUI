import { describe, expect, it } from 'vitest';
import type { ChartGeometry } from '../../../src/simulation/ui/chartGeometry';
import {
  createPathTransition,
  pathsForVisualGeometry,
  visualGeometry,
  type VisualChartGeometry,
} from '../../../src/simulation/ui/chartMotionGeometry';

const previous: VisualChartGeometry = {
  current: [{ x: 0, y: 80 }, { x: 30, y: 20 }],
  savings: [{ x: 0, y: 90 }, { x: 30, y: 40 }],
  bottom: 100,
};

const next: VisualChartGeometry = {
  current: [{ x: 0, y: 70 }, { x: 10, y: 50 }, { x: 20, y: 30 }, { x: 30, y: 10 }],
  savings: [{ x: 0, y: 85 }, { x: 10, y: 65 }, { x: 20, y: 45 }, { x: 30, y: 25 }],
  bottom: 120,
};

const emptyPrevious: VisualChartGeometry = {
  current: [],
  savings: [],
  bottom: 100,
};

const emptyNext: VisualChartGeometry = {
  current: [],
  savings: [],
  bottom: 120,
};

describe('chart motion geometry', () => {
  it('converts final chart points into visual path geometry without changing their coordinates', () => {
    const geometry = {
      plot: { left: 36, right: 656, top: 20, bottom: 249 },
      points: [
        { x: 36, currentY: 249, allSavingsY: 249 },
        { x: 656, currentY: 20, allSavingsY: 67 },
      ],
    } as ChartGeometry;

    expect(visualGeometry(geometry)).toEqual({
      current: [{ x: 36, y: 249 }, { x: 656, y: 20 }],
      savings: [{ x: 36, y: 249 }, { x: 656, y: 67 }],
      bottom: 249,
    });
  });

  it('resamples the full previous curve at transition start when the next curve has more points', () => {
    const transition = createPathTransition(previous, next);

    const start = transition(0);
    expect(start.current).toEqual([
      { x: 0, y: 80 }, { x: 10, y: 60 }, { x: 20, y: 40 }, { x: 30, y: 20 },
    ]);
    expect(start.savings.map((point) => point.y)).toEqual([
      90, expect.closeTo(220 / 3), expect.closeTo(170 / 3), 40,
    ]);
    expect(start.bottom).toBe(100);
  });

  it('ends a resampled transition at the exact next geometry with finite SVG path strings', () => {
    const frame = createPathTransition(previous, next)(1);

    expect(frame).toEqual(next);
    expect(Object.values(pathsForVisualGeometry(frame)).every((path) => (
      path !== '' && !path.includes('NaN') && !path.includes('Infinity')
    ))).toBe(true);
  });

  it('commits the target frame when a prior visual curve is empty', () => {
    expect(createPathTransition(emptyPrevious, next)(0)).toEqual(next);
  });

  it('commits the target frame when a target visual curve is empty', () => {
    expect(createPathTransition(previous, emptyNext)(0)).toEqual(emptyNext);
  });

  it('clamps animation progress outside its supported range to a complete visual frame', () => {
    const transition = createPathTransition(previous, next);

    expect(transition(-0.5).bottom).toBe(100);
    expect(transition(1.5)).toEqual(next);
  });
});
