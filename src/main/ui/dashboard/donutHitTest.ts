import type { DonutAllocation } from '../../domain/cashflowInsight';

interface DonutPoint {
  x: number;
  y: number;
}

interface DonutBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function hitTestDonutAllocation(
  allocations: DonutAllocation[],
  point: DonutPoint,
  bounds: DonutBounds,
): DonutAllocation['id'] | undefined {
  if (bounds.width <= 0 || bounds.height <= 0) return undefined;

  const viewBoxX = ((point.x - bounds.left) / bounds.width) * 100;
  const viewBoxY = ((point.y - bounds.top) / bounds.height) * 100;
  const deltaX = viewBoxX - 50;
  const deltaY = viewBoxY - 50;
  const radius = Math.hypot(deltaX, deltaY);
  if (radius < 33 || radius > 47) return undefined;

  const radians = Math.atan2(deltaX, -deltaY);
  const clockwisePercentage = (
    (radians < 0 ? radians + Math.PI * 2 : radians) / (Math.PI * 2)
  ) * 100;
  let offset = 0;

  for (const allocation of allocations) {
    const visiblePercentage = Math.min(
      Math.max(0, allocation.displayPercentage),
      Math.max(0, 100 - offset),
    );
    if (
      clockwisePercentage >= offset
      && clockwisePercentage < offset + visiblePercentage
    ) {
      return allocation.id;
    }
    offset += visiblePercentage;
  }

  return undefined;
}
