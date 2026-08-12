import { animate, type JSAnimation } from 'animejs';
import { MOTION_DURATION, MOTION_EASE } from './tokens';

interface VisualNumberState {
  value: number;
  animation?: JSAnimation;
}

const visualNumberStates = new WeakMap<HTMLElement, VisualNumberState>();

export function animateVisualNumber(
  element: HTMLElement,
  from: number,
  to: number,
  format: (value: number) => string,
  duration = MOTION_DURATION.normal,
): void {
  const previousState = visualNumberStates.get(element);
  previousState?.animation?.cancel();

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    element.textContent = format(to);
    visualNumberStates.set(element, { value: to });
    return;
  }

  const state: VisualNumberState = { value: previousState?.value ?? from };
  element.textContent = format(state.value);
  visualNumberStates.set(element, state);

  state.animation = animate(state, {
    value: to,
    duration,
    ease: MOTION_EASE.update,
    onUpdate: () => {
      element.textContent = format(state.value);
    },
  });
}
