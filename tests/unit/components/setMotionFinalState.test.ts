import { describe, expect, it } from 'vitest';
import { setMotionFinalState } from '../../../src/components/motion/setMotionFinalState';

describe('setMotionFinalState', () => {
  it('commits the visible reveal state without animation', () => {
    const target = document.createElement('div');
    target.style.opacity = '0';
    target.style.transform = 'translateY(24px)';

    setMotionFinalState(target);

    expect(target.style.opacity).toBe('1');
    expect(target.style.transform).toBe('translateY(0px)');
  });
});
