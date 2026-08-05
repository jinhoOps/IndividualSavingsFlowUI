export interface TooltipPoint { x: number; y: number }
export interface TooltipSize { width: number; height: number }

export function clampTooltipPosition(
  pointer: TooltipPoint,
  tooltip: TooltipSize,
  viewport: TooltipSize,
  gutter = 16,
): { left: number; top: number } {
  return {
    left: Math.max(gutter, Math.min(pointer.x + 12, viewport.width - gutter - tooltip.width)),
    top: Math.max(gutter, Math.min(pointer.y + 12, viewport.height - gutter - tooltip.height)),
  };
}
