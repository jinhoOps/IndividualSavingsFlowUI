import type { JSAnimation } from 'animejs';
import {
  exitingDonutSegment,
  mergeDonutAllocationIds,
  type DonutSegmentGeometry,
} from './cashflowDonutGeometry';
import type { DonutAllocation } from '../../domain/cashflowInsight';

export interface DonutSegmentMotionState {
  visiblePercentage: number;
  dashoffset: number;
  animation?: JSAnimation;
}

export function setCircleGeometry(
  circle: SVGCircleElement,
  geometry: Pick<DonutSegmentMotionState, 'visiblePercentage' | 'dashoffset'>,
): void {
  circle.setAttribute(
    'stroke-dasharray',
    `${geometry.visiblePercentage} ${100 - geometry.visiblePercentage}`,
  );
  circle.setAttribute('stroke-dashoffset', String(geometry.dashoffset));
}

export function commitFinalDonutGeometry(
  renderedIds: DonutAllocation['id'][],
  targetIds: DonutAllocation['id'][],
  targetById: Map<DonutAllocation['id'], DonutSegmentGeometry>,
  circles: Map<DonutAllocation['id'], SVGCircleElement>,
  states: Map<DonutAllocation['id'], DonutSegmentMotionState>,
): void {
  for (const id of mergeDonutAllocationIds(renderedIds, targetIds)) {
    const circle = circles.get(id);
    if (circle === undefined) continue;
    const segment = targetById.get(id) ?? exitingDonutSegment(id);
    const state = states.get(id) ?? {
      visiblePercentage: segment.visiblePercentage,
      dashoffset: segment.dashoffset,
    };
    states.set(id, state);
    commitFinalDonutSegment(id, circle, state, segment, !targetById.has(id), states);
  }
}

function commitFinalDonutSegment(
  id: DonutAllocation['id'],
  circle: SVGCircleElement,
  state: DonutSegmentMotionState,
  segment: DonutSegmentGeometry,
  exiting: boolean,
  states: Map<DonutAllocation['id'], DonutSegmentMotionState>,
): void {
  state.visiblePercentage = segment.visiblePercentage;
  state.dashoffset = segment.dashoffset;
  state.animation = undefined;
  setCircleGeometry(circle, state);
  if (exiting) states.delete(id);
}
