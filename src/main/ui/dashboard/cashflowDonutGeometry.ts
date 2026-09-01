import type { DonutAllocation } from '../../domain/cashflowInsight';

export interface DonutSegmentGeometry {
  id: DonutAllocation['id'];
  visiblePercentage: number;
  dashoffset: number;
}

export const DONUT_ALLOCATION_IDS: readonly DonutAllocation['id'][] = [
  'consumption',
  'saving',
  'investment',
  'remaining',
];

export function createDonutSegmentGeometry(
  allocations: readonly DonutAllocation[],
): DonutSegmentGeometry[] {
  let offset = 0;
  return allocations.map((allocation) => {
    const visiblePercentage = Math.min(allocation.displayPercentage, Math.max(0, 100 - offset));
    const segment = {
      id: allocation.id,
      visiblePercentage,
      dashoffset: -offset,
    };
    offset += visiblePercentage;
    return segment;
  });
}

export function exitingDonutSegment(id: DonutAllocation['id']): DonutSegmentGeometry {
  return { id, visiblePercentage: 0, dashoffset: -100 };
}

export function mergeDonutAllocationIds(
  previousIds: readonly DonutAllocation['id'][],
  currentIds: readonly DonutAllocation['id'][],
): DonutAllocation['id'][] {
  return DONUT_ALLOCATION_IDS.filter((id) => (
    previousIds.includes(id) || currentIds.includes(id)
  ));
}
