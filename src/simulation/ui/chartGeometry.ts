import type { CompoundSimulationDraft, ProjectionPoint } from '../domain/model';

export interface ChartGeometryPoint {
  year: number;
  x: number;
  currentY: number;
  allSavingsY: number;
  point: ProjectionPoint;
}

export interface ChartGeometry {
  plot: { left: number; right: number; top: number; bottom: number };
  points: ChartGeometryPoint[];
  currentPlanPath: string;
  allSavingsPath: string;
  currentPlanAreaPath: string;
}

export function buildChartGeometry(
  points: ProjectionPoint[],
  amountMode: CompoundSimulationDraft['amountMode'],
  size = { width: 680, height: 285 },
): ChartGeometry {
  const plot = {
    left: 36,
    right: size.width - 24,
    top: 20,
    bottom: size.height - 36,
  };
  const maxYear = Math.max(1, ...points.map((point) => point.year));
  const amount = (point: ProjectionPoint, series: 'current' | 'allSavings') => {
    if (amountMode === 'real') {
      return series === 'current' ? point.currentPlanRealWon : point.allSavingsRealWon;
    }
    return series === 'current' ? point.currentPlanNominalWon : point.allSavingsNominalWon;
  };
  const maxAmount = Math.max(
    1,
    ...points.flatMap((point) => [amount(point, 'current'), amount(point, 'allSavings')]),
  );
  const geometryPoints = points.map((point) => ({
    year: point.year,
    x: plot.left + point.year / maxYear * (plot.right - plot.left),
    currentY: plot.bottom - amount(point, 'current') / maxAmount * (plot.bottom - plot.top),
    allSavingsY: plot.bottom - amount(point, 'allSavings') / maxAmount * (plot.bottom - plot.top),
    point,
  }));
  const currentPlanPath = pathFor(geometryPoints, 'currentY');
  const allSavingsPath = pathFor(geometryPoints, 'allSavingsY');
  const first = geometryPoints[0];
  const last = geometryPoints.at(-1);
  const currentPlanAreaPath = first === undefined || last === undefined
    ? ''
    : `${currentPlanPath} L ${last.x} ${plot.bottom} L ${first.x} ${plot.bottom} Z`;

  return {
    plot,
    points: geometryPoints,
    currentPlanPath,
    allSavingsPath,
    currentPlanAreaPath,
  };
}

function pathFor(
  points: ChartGeometryPoint[],
  yKey: 'currentY' | 'allSavingsY',
): string {
  return points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point[yKey]}`
  )).join(' ');
}
