import * as Anime from 'animejs';

export const DIALOG_MOTION_MS = 450;
const SPRING_PERCEIVED_MS = 260;

export function createDialogMotionTiming(bounce: number): { duration: number; ease: (progress: number) => number } {
  let createSpring: typeof Anime.spring | undefined;
  try { createSpring = Anime.spring; } catch { /* focused tests may mock only animate */ }
  const curve = typeof createSpring === 'function'
    ? createSpring({ bounce, duration: SPRING_PERCEIVED_MS })
    : undefined;
  return {
    duration: DIALOG_MOTION_MS,
    ease: (progress) => (
      progress <= 0 ? 0 : progress >= 1 ? 1 : curve?.ease(progress) ?? progress
    ),
  };
}

export function readDialogTranslateY(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  let y = 0;
  const add = (value: string | undefined) => {
    if (value === undefined) return;
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) y += parsed;
  };
  const individualTranslate = style.translate;
  if (individualTranslate !== '' && individualTranslate !== 'none') {
    add(individualTranslate.trim().split(/[\s,]+/)[1]);
  }
  const transform = style.transform;
  if (transform.startsWith('matrix3d(')) {
    add(transform.slice(9, -1).split(',')[13]);
  } else if (transform.startsWith('matrix(')) {
    add(transform.slice(7, -1).split(',')[5]);
  } else {
    const match = transform.match(/translateY\(\s*(-?[\d.]+)px\)/)
      ?? transform.match(/translate\(\s*[-\d.]+px\s*,\s*(-?[\d.]+)px\s*\)/);
    if (match !== null) add(match[1]);
  }
  return y;
}
