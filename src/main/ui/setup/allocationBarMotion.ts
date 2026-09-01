import type { JSAnimation } from 'animejs';
import type { CashflowBarGeometry } from './cashflowBarGeometry';
import type { CashflowAllocationId } from './cashflowBarModel';

export interface AllocationBarMotionState {
  consumption: number;
  saving: number;
  investment: number;
  remaining: number;
  desiredEndPercent: number;
  visibleEndPercent: number;
  animation?: JSAnimation;
}

export function createBarMotionState(
  geometry: CashflowBarGeometry,
): AllocationBarMotionState {
  const widths = new Map(geometry.segments.map((segment) => [segment.id, segment.widthPercent]));
  return {
    consumption: widths.get('consumption') ?? 0,
    saving: widths.get('saving') ?? 0,
    investment: widths.get('investment') ?? 0,
    remaining: widths.get('remaining') ?? 0,
    desiredEndPercent: geometry.desiredEndPercent,
    visibleEndPercent: geometry.visibleEndPercent,
  };
}

export function applyBarMotionState(root: HTMLElement, state: AllocationBarMotionState): void {
  const clip = root.querySelector<HTMLElement>('.cashflow-bar__clip');
  const strip = root.querySelector<HTMLElement>('.allocation-bar__visual-track');
  if (clip === null || strip === null) return;

  clip.style.width = `${state.visibleEndPercent}%`;
  strip.style.width = `${relativeStripWidth(state.desiredEndPercent, state.visibleEndPercent)}%`;
  for (const segment of strip.querySelectorAll<HTMLElement>('[data-segment-id]')) {
    const id = segment.dataset.segmentId as CashflowAllocationId;
    segment.style.width = `${relativeSegmentWidth(state[id], state.desiredEndPercent)}%`;
  }
}

export function commitFinalBarMotion(
  state: AllocationBarMotionState,
  target: AllocationBarMotionState,
  root: HTMLElement,
  targetIds: CashflowAllocationId[],
  setVisualSegmentIds: (ids: CashflowAllocationId[]) => void,
): void {
  assignBarMotionState(state, target);
  state.animation = undefined;
  applyBarMotionState(root, state);
  setVisualSegmentIds(targetIds);
}

function assignBarMotionState(
  state: AllocationBarMotionState,
  target: AllocationBarMotionState,
): void {
  state.consumption = target.consumption;
  state.saving = target.saving;
  state.investment = target.investment;
  state.remaining = target.remaining;
  state.desiredEndPercent = target.desiredEndPercent;
  state.visibleEndPercent = target.visibleEndPercent;
}

function relativeStripWidth(desiredEndPercent: number, visibleEndPercent: number): number {
  return visibleEndPercent > 0 ? desiredEndPercent / visibleEndPercent * 100 : 0;
}

function relativeSegmentWidth(widthPercent: number, desiredEndPercent: number): number {
  return desiredEndPercent > 0 ? widthPercent / desiredEndPercent * 100 : 0;
}
