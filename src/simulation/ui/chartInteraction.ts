export type ChartKeyIntent = 'home' | 'end' | 'previous' | 'next';

export interface TooltipPlacementInput {
  anchorX: number;
  anchorY: number;
  chartWidth: number;
  tooltipWidth: number;
  tooltipHeight: number;
  gap?: number;
}

export interface TooltipPlacement {
  horizontal: 'left' | 'right';
  vertical: 'above' | 'below';
}

export function indexAtClientX({
  clientX,
  bounds,
  viewBoxWidth,
  plot,
  pointCount,
}: {
  clientX: number;
  bounds: Pick<DOMRect, 'left' | 'width'>;
  viewBoxWidth: number;
  plot: { left: number; right: number };
  pointCount: number;
}): number | null {
  if (pointCount <= 0 || bounds.width <= 0 || plot.right <= plot.left) return null;

  const viewBoxX = (clientX - bounds.left) / bounds.width * viewBoxWidth;
  const ratio = Math.max(0, Math.min(1, (viewBoxX - plot.left) / (plot.right - plot.left)));
  return Math.round(ratio * (pointCount - 1));
}

export function indexForKey(
  current: number | null,
  intent: ChartKeyIntent,
  pointCount: number,
): number | null {
  if (pointCount <= 0) return null;

  const last = pointCount - 1;
  if (intent === 'home') return 0;
  if (intent === 'end') return last;
  if (intent === 'previous') return Math.max(0, (current ?? 1) - 1);
  return Math.min(last, (current ?? -1) + 1);
}

export function tooltipPlacement({
  anchorX,
  anchorY,
  chartWidth,
  tooltipWidth,
  tooltipHeight,
  gap = 12,
}: TooltipPlacementInput): TooltipPlacement {
  return {
    horizontal: anchorX + gap + tooltipWidth > chartWidth ? 'left' : 'right',
    vertical: anchorY - gap - tooltipHeight < 0 ? 'below' : 'above',
  };
}
