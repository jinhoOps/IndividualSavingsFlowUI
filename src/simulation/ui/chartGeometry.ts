import type { ChartSeriesPoint } from './chartSeries';

export interface ChartGeometryPoint extends ChartSeriesPoint {
  x: number;
  currentY: number;
  allSavingsY: number;
}

export interface ChartGeometry {
  plot: { left: number; right: number; top: number; bottom: number };
  points: ChartGeometryPoint[];
  currentPlanPath: string;
  allSavingsPath: string;
  currentPlanAreaPath: string;
  xTicks: Array<{ x: number; label: string }>;
  yTicks: Array<{ y: number; label: string }>;
}

export function buildChartGeometry(
  series: readonly ChartSeriesPoint[],
  size = { width: 680, height: 285 },
): ChartGeometry {
  const plot = {
    left: 36,
    right: size.width - 24,
    top: 20,
    bottom: size.height - 36,
  };
  const maxMonth = Math.max(1, ...series.map(({ month }) => month));
  const maxAmount = Math.max(
    1,
    ...series.flatMap(({ currentPlanWon, allSavingsWon }) => [currentPlanWon, allSavingsWon]),
  );
  const geometryPoints = series.map((point) => ({
    ...point,
    x: plot.left + point.month / maxMonth * (plot.right - plot.left),
    currentY: plot.bottom - point.currentPlanWon / maxAmount * (plot.bottom - plot.top),
    allSavingsY: plot.bottom - point.allSavingsWon / maxAmount * (plot.bottom - plot.top),
  }));
  const currentPlanPath = pathFor(geometryPoints, 'currentY');
  const allSavingsPath = pathFor(geometryPoints, 'allSavingsY');
  const first = geometryPoints[0];
  const last = geometryPoints.at(-1);
  const currentPlanAreaPath = first === undefined || last === undefined
    ? ''
    : `${currentPlanPath} L ${last.x} ${plot.bottom} L ${first.x} ${plot.bottom} Z`;

  const isMonthlySeries = geometryPoints.length > 1
    && geometryPoints.every((point, index) => point.month === index);
  const tickInterval = isMonthlySeries ? 6 : 60;
  const tickPoints = geometryPoints.filter((point, index) => (
    index === 0
    || index === geometryPoints.length - 1
    || (geometryPoints.length > 6 && point.month % tickInterval === 0)
  ));
  const xTicks = tickPoints.map((point) => ({
    x: point.x,
    label: formatProjectionPeriod(point.month),
  }));
  const yTicks = [0, maxAmount / 2, maxAmount].map((value) => ({
    y: plot.bottom - value / maxAmount * (plot.bottom - plot.top),
    label: formatChartAxisWon(value),
  }));

  return {
    plot,
    points: geometryPoints,
    currentPlanPath,
    allSavingsPath,
    currentPlanAreaPath,
    xTicks,
    yTicks,
  };
}

export interface TooltipPlacementInput {
  anchorX: number;
  anchorY: number;
  chartWidth: number;
  tooltipWidth: number;
  tooltipHeight: number;
  gap?: number;
}

export function tooltipPlacement({
  anchorX,
  anchorY,
  chartWidth,
  tooltipWidth,
  tooltipHeight,
  gap = 12,
}: TooltipPlacementInput): {
  horizontal: 'left' | 'right';
  vertical: 'above' | 'below';
} {
  return {
    horizontal: anchorX + gap + tooltipWidth > chartWidth ? 'left' : 'right',
    vertical: anchorY - gap - tooltipHeight < 0 ? 'below' : 'above',
  };
}

export function formatChartAxisWon(amountWon: number): string {
  const absolute = Math.abs(amountWon);
  if (absolute >= 100_000_000) return `${Math.round(amountWon / 100_000_000)}억`;
  if (absolute >= 10_000) return `${Math.round(amountWon / 10_000)}만`;
  if (absolute >= 1_000) return `${Math.round(amountWon / 1_000)}천`;
  return `${Math.round(amountWon)}`;
}

export function formatProjectionPeriod(month: number): string {
  const normalizedMonth = Math.max(0, Math.round(month));
  if (normalizedMonth === 0) return '현재';
  if (normalizedMonth < 12) return `${normalizedMonth}개월`;

  const years = Math.floor(normalizedMonth / 12);
  const months = normalizedMonth % 12;
  return months === 0 ? `${years}년` : `${years}년 ${months}개월`;
}

function pathFor(
  points: ChartGeometryPoint[],
  yKey: 'currentY' | 'allSavingsY',
): string {
  return points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point[yKey]}`
  )).join(' ');
}
