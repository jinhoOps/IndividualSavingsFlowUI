import * as Anime from 'animejs';

export const MOTION_DURATION = { fast: 120, normal: 180, emphasis: 260 } as const;
export const MOTION_DISTANCE_PX = { subtle: 4, reveal: 8 } as const;
export const MOTION_EASE = { enter: 'out(3)', update: 'inOut(2)' } as const;

export type ProductMotionRole = 'surface' | 'return' | 'exit' | 'value';

const PRODUCT_SPRING: Record<ProductMotionRole, { bounce: number; duration: number }> = {
  surface: { bounce: 0.12, duration: MOTION_DURATION.emphasis },
  return: { bounce: 0.12, duration: 220 },
  exit: { bounce: 0, duration: MOTION_DURATION.normal },
  value: { bounce: 0, duration: MOTION_DURATION.emphasis },
};

/** Create a fresh easing instance so each animation owns its spring state. */
export function createProductSpring(role: ProductMotionRole): ReturnType<typeof Anime.spring> {
  // Unit tests that mock only animate/createScope predate the spring profiles.
  // Keep those isolated tests deterministic while production uses Anime.js spring.
  let createSpring: typeof Anime.spring | undefined;
  try {
    createSpring = Anime.spring;
  } catch {
    createSpring = undefined;
  }
  if (typeof createSpring !== 'function') {
    return (role === 'surface' || role === 'return' ? MOTION_EASE.enter : MOTION_EASE.update) as unknown as ReturnType<typeof Anime.spring>;
  }
  return createSpring(PRODUCT_SPRING[role]);
}
