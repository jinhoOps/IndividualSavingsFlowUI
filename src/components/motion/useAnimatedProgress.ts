import { animate, type EasingParam } from 'animejs';
import { useRef } from 'react';
import { attemptMotion } from './attemptMotion';
import { MOTION_DURATION, MOTION_EASE } from './tokens';
import { useAnimeScope } from './useAnimeScope';

/** Preserve the displayed percentage across interrupted setup steps. */
export function useAnimatedProgress<T extends HTMLElement>(
  percentage: number,
  easing: EasingParam = MOTION_EASE.update,
) {
  const displayed = useRef(percentage);
  return useAnimeScope<T>(({ root, reducedMotion }) => {
    let active = true;
    const paint = (value: number) => {
      if (!active) return;
      displayed.current = value;
      root.style.width = `${value}%`;
    };
    if (reducedMotion || displayed.current === percentage) {
      paint(percentage);
    } else {
      const state = { value: displayed.current };
      paint(state.value);
      if (!attemptMotion(() => animate(state, {
        value: percentage, duration: MOTION_DURATION.normal, ease: easing,
        onUpdate: () => paint(state.value),
        onComplete: () => paint(percentage),
      }))) paint(percentage);
    }
    return () => { active = false; };
  }, [percentage]);
}
