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
  duration: number = MOTION_DURATION.normal,
): () => void {
  const previousState = visualNumberStates.get(element);

  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    commitVisualNumber(element, to, format);
    return () => undefined;
  }

  previousState?.animation?.cancel();

  const state: VisualNumberState = { value: previousState?.value ?? from };
  element.textContent = format(state.value);
  visualNumberStates.set(element, state);

  try {
    state.animation = animate(state, {
      value: to,
      duration,
      ease: MOTION_EASE.update,
      onUpdate: () => {
        element.textContent = format(state.value);
      },
    });
  } catch {
    state.value = to;
    state.animation = undefined;
    element.textContent = format(to);
  }

  return () => {
    state.animation?.cancel();
    state.animation = undefined;
  };
}

export function commitVisualNumber(
  element: HTMLElement,
  value: number,
  format: (value: number) => string,
): void {
  visualNumberStates.get(element)?.animation?.cancel();
  element.textContent = format(value);
  visualNumberStates.set(element, { value });
}
