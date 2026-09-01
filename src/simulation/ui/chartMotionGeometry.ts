import type { ChartGeometry } from './chartGeometry';

export interface VisualPathPoint {
  x: number;
  y: number;
}

export interface VisualChartGeometry {
  current: VisualPathPoint[];
  savings: VisualPathPoint[];
  bottom: number;
}

export interface ChartPaths {
  area: string;
  current: string;
  savings: string;
}

export function visualGeometry(geometry: ChartGeometry): VisualChartGeometry {
  return {
    current: geometry.points.map((point) => ({ x: point.x, y: point.currentY })),
    savings: geometry.points.map((point) => ({ x: point.x, y: point.allSavingsY })),
    bottom: geometry.plot.bottom,
  };
}

export function pathsForVisualGeometry(geometry: VisualChartGeometry): ChartPaths {
  const current = pathForVisualPoints(geometry.current);
  const savings = pathForVisualPoints(geometry.savings);
  const first = geometry.current[0];
  const last = geometry.current.at(-1);
  const area = first === undefined || last === undefined || current === ''
    ? ''
    : `${current} L ${last.x} ${geometry.bottom} L ${first.x} ${geometry.bottom} Z`;
  return { area, current, savings };
}

export function createPathTransition(
  previous: VisualChartGeometry,
  next: VisualChartGeometry,
): (progress: number) => VisualChartGeometry {
  const pointCount = Math.max(previous.current.length, next.current.length);
  const sourceCurrent = resample(previous.current, pointCount);
  const sourceSavings = resample(previous.savings, pointCount);
  const targetCurrent = resample(next.current, pointCount);
  const targetSavings = resample(next.savings, pointCount);

  return (progress) => {
    const normalizedProgress = Math.max(0, Math.min(1, progress));
    return {
      current: interpolatePoints(sourceCurrent, targetCurrent, normalizedProgress),
      savings: interpolatePoints(sourceSavings, targetSavings, normalizedProgress),
      bottom: previous.bottom + (next.bottom - previous.bottom) * normalizedProgress,
    };
  };
}

function resample(points: VisualPathPoint[], count: number): VisualPathPoint[] {
  if (count <= 0 || points.length === 0) return [];
  if (count === 1) return [points[0]];
  return Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1) * (points.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.min(points.length - 1, Math.ceil(position));
    const lower = points[lowerIndex];
    const upper = points[upperIndex];
    const progress = position - lowerIndex;
    return {
      x: lower.x + (upper.x - lower.x) * progress,
      y: lower.y + (upper.y - lower.y) * progress,
    };
  });
}

function interpolatePoints(
  previous: VisualPathPoint[],
  next: VisualPathPoint[],
  progress: number,
): VisualPathPoint[] {
  return next.map((point, index) => ({
    x: previous[index].x + (point.x - previous[index].x) * progress,
    y: previous[index].y + (point.y - previous[index].y) * progress,
  }));
}

function pathForVisualPoints(points: VisualPathPoint[]): string {
  return points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  )).join(' ');
}
