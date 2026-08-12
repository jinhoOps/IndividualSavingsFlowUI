import { animate, type JSAnimation } from 'animejs';
import { attemptMotion } from './attemptMotion';
import { MOTION_DURATION, MOTION_EASE } from './tokens';

interface VisualNumberState {
  active: boolean;
  cancellationFailed: boolean;
  targetValue: number;
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

  const startingValue = previousState?.value ?? from;
  if (previousState !== undefined) {
    previousState.active = false;
    const previousAnimation = previousState.animation;
    previousState.animation = undefined;
    if (
      previousAnimation !== undefined
      && !attemptMotion(() => previousAnimation.cancel())
    ) {
      element.textContent = format(to);
      visualNumberStates.set(element, {
        active: false,
        cancellationFailed: false,
        targetValue: to,
        value: to,
      });
      return () => undefined;
    }
    if (previousState.cancellationFailed) {
      element.textContent = format(to);
      visualNumberStates.set(element, {
        active: false,
        cancellationFailed: false,
        targetValue: to,
        value: to,
      });
      return () => undefined;
    }
  }

  const state: VisualNumberState = {
    active: true,
    cancellationFailed: false,
    targetValue: to,
    value: startingValue,
  };
  element.textContent = format(state.value);
  visualNumberStates.set(element, state);

  try {
    state.animation = animate(state, {
      value: to,
      duration,
      ease: MOTION_EASE.update,
      onUpdate: () => {
        if (!state.active || visualNumberStates.get(element) !== state) return;
        element.textContent = format(state.value);
      },
    });
  } catch {
    state.active = false;
    state.value = to;
    state.animation = undefined;
    element.textContent = format(to);
  }

  return () => {
    state.active = false;
    const animation = state.animation;
    state.animation = undefined;
    if (
      animation !== undefined
      && !attemptMotion(() => animation.cancel())
    ) {
      state.cancellationFailed = true;
      state.value = state.targetValue;
      if (visualNumberStates.get(element) === state) {
        element.textContent = format(state.targetValue);
      }
    }
  };
}

export function commitVisualNumber(
  element: HTMLElement,
  value: number,
  format: (value: number) => string,
): void {
  const previousState = visualNumberStates.get(element);
  if (previousState !== undefined) {
    previousState.active = false;
    const previousAnimation = previousState.animation;
    previousState.animation = undefined;
    if (previousAnimation !== undefined) attemptMotion(() => previousAnimation.cancel());
  }
  element.textContent = format(value);
  visualNumberStates.set(element, {
    active: false,
    cancellationFailed: false,
    targetValue: value,
    value,
  });
}
