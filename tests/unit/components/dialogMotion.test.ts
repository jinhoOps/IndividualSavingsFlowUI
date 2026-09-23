import { animate } from 'animejs';
import { describe, expect, it } from 'vitest';
import { createDialogMotionTiming, DIALOG_MOTION_MS } from '../../../src/components/motion/dialogMotion';

describe('dialog motion timing', () => {
  it('maps the complete spring curve onto 450ms of actual Anime duration', () => {
    const timing = createDialogMotionTiming(0.12);
    expect(DIALOG_MOTION_MS).toBe(450);
    expect(timing.duration).toBe(450);
    expect(typeof timing.ease).toBe('function');
    expect(timing.ease(0)).toBeCloseTo(0);
    expect(timing.ease(1)).toBeCloseTo(1, 2);

    const animation = animate({ value: 0 }, { value: 1, autoplay: false, ...timing });
    expect(animation.duration).toBe(450);
    animation.cancel();
  });

  it('clamps spring endpoints while preserving its interior bounce', () => {
    const ease = createDialogMotionTiming(0.12).ease;
    expect(ease(-0.1)).toBe(0);
    expect(ease(1.1)).toBe(1);
    expect(ease(0.7)).toBeGreaterThan(1);
  });
});
